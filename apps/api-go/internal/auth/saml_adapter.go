// SAML attribute adapter — flattens crewjam's OID-keyed AttributeStatements
// into the AuthProfile shape the rest of the auth stack expects.
//
// Phase 0 POC (apps/api-go/cmd/poc-ext-deps/main.go §4) proved that
// crewjam/saml returns AttributeStatements as []Attribute with `.Name`
// and `.Values`, while @node-saml/node-saml flattens attributes into a
// single profile dict. We do the flattening here so the rest of the
// code can treat SAML the same as the NestJS version did.
//
// Two-step adapter:
//  1. FlattenAttributes: []saml.Attribute → map[attributeName][]stringValue
//  2. ExtractProfile: pull the standard IdP claims (email, displayName)
//     from the flat map and return a populated AuthProfile.
//
// Claim name matching handles the three common shapes IdPs emit:
//   - Friendly: "email", "displayName", "givenName"
//   - OID:      "urn:oid:0.9.2342.19200300.100.1.3" (email)
//   - URI:      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
package auth

import "github.com/crewjam/saml"

// FlattenAttributes walks the SAML AttributeStatements and returns
// {attributeName: [value1, value2, ...]}. Multi-valued attributes
// preserve their order. This is the shape the NestJS service exposes
// as `profile.attributes`.
func FlattenAttributes(assertion *saml.Assertion) map[string][]string {
	out := make(map[string][]string)
	if assertion == nil {
		return out
	}
	for _, stmt := range assertion.AttributeStatements {
		for _, attr := range stmt.Attributes {
			if attr.Name == "" {
				continue
			}
			values := make([]string, 0, len(attr.Values))
			for _, v := range attr.Values {
				values = append(values, v.Value)
			}
			out[attr.Name] = values
		}
	}
	return out
}

// ExtractProfile pulls the standard IdP claims (email, displayName) out
// of the flattened attribute map. Returns a populated AuthProfile with
// the raw attribute map preserved.
//
// The claim-name fallback ladder handles both friendly names (Okta's
// "email") and OID/URI forms (AAD's "http://schemas.xmlsoap.org/.../
// emailaddress"). Same ladder the NestJS service uses in
// sso.provider.ts:57-60.
func ExtractProfile(nameID string, attrs map[string][]string) AuthProfile {
	email := firstAttributeValue(attrs,
		"email",
		"mail",
		"urn:oid:0.9.2342.19200300.100.1.3", // RFC 4519 OID for mail
		"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
		"http://schemas.xmlsoap.org/claims/EmailAddress",
	)
	name := firstAttributeValue(attrs,
		"displayName",
		"cn",
		"name",
		"urn:oid:2.16.840.1.113730.3.1.241", // RFC 4519 OID for displayName
		"urn:oid:2.5.4.3",                   // RFC 4519 OID for commonName
		"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
		"http://schemas.xmlsoap.org/claims/CommonName",
	)
	if name == "" && email != "" {
		// Fall back to local-part of email, same trick the OAuth provider uses.
		if at := indexByte(email, '@'); at > 0 {
			name = email[:at]
		} else {
			name = email
		}
	}
	emailVerified := firstAttributeValue(attrs,
		"email_verified",
		"verified_email",
	) == "true" || email != "" // IdP presence implies verified for SAML
	return AuthProfile{
		Email:         email,
		EmailVerified: emailVerified,
		Name:          name,
		// AvatarURL: SAML doesn't carry avatar; we leave it empty.
		// The dispatcher's upsert path treats "" as "use the existing value".
		Raw: map[string]any{
			"nameID":    nameID,
			"assertion": attrs,
		},
	}
}

// firstAttributeValue returns the first non-empty value from the named
// attributes, checked in order. Returns "" if none have a value.
func firstAttributeValue(attrs map[string][]string, names ...string) string {
	for _, name := range names {
		if vs, ok := attrs[name]; ok && len(vs) > 0 {
			for _, v := range vs {
				if v != "" {
					return v
				}
			}
		}
	}
	return ""
}
