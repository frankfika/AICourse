// hackathons_sub.go — Fiber HTTP handlers for the hackathons sub-resources
// (teams, submissions, judges, sponsors). Phase 2 T19.1.
//
// All routes are mounted under /api/v1/hackathons/:id/... by the Mount()
// method in hackathons.go. Auth is enforced at the route level (admin /
// authenticated / public). The service layer is responsible for the
// business rules (registered check, member check, ownership check).
package handler

import (
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/hackathons"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/gofiber/fiber/v2"
)

// ============ Teams ============

// listTeams returns the public team list for a hackathon.
//
//	GET /api/v1/hackathons/:id/teams
func (h *HackathonsHandler) listTeams(c *fiber.Ctx) error {
	rows, err := h.svc.ListTeams(c.Context(), c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

// createTeam creates a team. Caller becomes the captain.
//
//	POST /api/v1/hackathons/:id/teams
func (h *HackathonsHandler) createTeam(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		Name   string `json:"name"`
		Slogan string `json:"slogan"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	dto, err := h.svc.CreateTeam(c.Context(), claims.UserID, c.Params("id"), hackathons.CreateTeamInput{
		Name:   body.Name,
		Slogan: body.Slogan,
	})
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(dto)
}

// joinTeam adds the caller to a team.
//
//	POST /api/v1/hackathons/:id/teams/:teamId/join
func (h *HackathonsHandler) joinTeam(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	dto, err := h.svc.JoinTeam(c.Context(), claims.UserID, c.Params("id"), c.Params("teamId"))
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(dto)
}

// leaveTeam removes the caller from a team. If captain → disband.
//
//	POST /api/v1/hackathons/:id/teams/:teamId/leave
func (h *HackathonsHandler) leaveTeam(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	res, err := h.svc.LeaveTeam(c.Context(), claims.UserID, c.Params("id"), c.Params("teamId"))
	if err != nil {
		return err
	}
	return c.JSON(res)
}

// ============ Submissions ============

// listMySubmissions returns the caller's own submissions for a
// hackathon (user-owned + team-member-owned).
//
//	GET /api/v1/hackathons/:id/submissions
func (h *HackathonsHandler) listMySubmissions(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	rows, err := h.svc.ListMySubmissions(c.Context(), claims.UserID, c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

// listAllSubmissions returns all submissions for a hackathon. Admin.
//
//	GET /api/v1/hackathons/:id/submissions/all
func (h *HackathonsHandler) listAllSubmissions(c *fiber.Ctx) error {
	rows, err := h.svc.ListAllSubmissions(c.Context(), c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

// createSubmission inserts a new submission. Caller is set as user_id
// (or NULL if teamId is supplied).
//
//	POST /api/v1/hackathons/:id/submissions
func (h *HackathonsHandler) createSubmission(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		Title       string  `json:"title"`
		Description string  `json:"description"`
		DemoURL     string  `json:"demoUrl"`
		RepoURL     string  `json:"repoUrl"`
		VideoURL    string  `json:"videoUrl"`
		TeamID      string  `json:"teamId"`
		Status      string  `json:"status"`
		Score       *string `json:"score"`
		Feedback    string  `json:"feedback"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	// Map the optional score → *float64 for the judge-style path. The
	// create endpoint does not use it (mirrors NestJS — score is
	// only set via the judge endpoint), so we ignore it here.
	_ = body.Score
	_ = body.Feedback
	dto, err := h.svc.CreateSubmission(c.Context(), claims.UserID, c.Params("id"), hackathons.CreateSubmissionInput{
		Title:       body.Title,
		Description: body.Description,
		DemoURL:     body.DemoURL,
		RepoURL:     body.RepoURL,
		VideoURL:    body.VideoURL,
		TeamID:      body.TeamID,
		Status:      body.Status,
	})
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(dto)
}

// updateSubmission applies a partial update to a submission. Owner or
// team-member only.
//
//	PATCH /api/v1/hackathons/:id/submissions/:submissionId
func (h *HackathonsHandler) updateSubmission(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		DemoURL     string `json:"demoUrl"`
		RepoURL     string `json:"repoUrl"`
		VideoURL    string `json:"videoUrl"`
		Status      string `json:"status"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	dto, err := h.svc.UpdateSubmission(c.Context(), claims.UserID, c.Params("id"), c.Params("submissionId"), hackathons.UpdateSubmissionInput{
		Title:       body.Title,
		Description: body.Description,
		DemoURL:     body.DemoURL,
		RepoURL:     body.RepoURL,
		VideoURL:    body.VideoURL,
		Status:      body.Status,
	})
	if err != nil {
		return err
	}
	return c.JSON(dto)
}

// judgeSubmission records a score + feedback. Admin only.
//
//	POST /api/v1/hackathons/:id/submissions/:submissionId/judge
func (h *HackathonsHandler) judgeSubmission(c *fiber.Ctx) error {
	var body struct {
		Score    *float64 `json:"score"`
		Feedback string   `json:"feedback"`
		Status   string   `json:"status"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	dto, err := h.svc.JudgeSubmission(c.Context(), c.Params("id"), c.Params("submissionId"), hackathons.JudgeSubmissionInput{
		Score:    body.Score,
		Feedback: body.Feedback,
		Status:   body.Status,
	})
	if err != nil {
		return err
	}
	return c.JSON(dto)
}

// ============ Judges ============

// listJudges returns the public judge list for a hackathon.
//
//	GET /api/v1/hackathons/:id/judges
func (h *HackathonsHandler) listJudges(c *fiber.Ctx) error {
	rows, err := h.svc.ListJudges(c.Context(), c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

// addJudge inserts a new judge. Admin only.
//
//	POST /api/v1/hackathons/:id/judges
func (h *HackathonsHandler) addJudge(c *fiber.Ctx) error {
	var body struct {
		Name       string `json:"name"`
		Title      string `json:"title"`
		AvatarURL  string `json:"avatarUrl"`
		Bio        string `json:"bio"`
		OrderIndex *int32 `json:"orderIndex"`
		Role       string `json:"role"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	dto, err := h.svc.AddJudge(c.Context(), c.Params("id"), hackathons.AddJudgeInput{
		Name:       body.Name,
		Title:      body.Title,
		AvatarURL:  body.AvatarURL,
		Bio:        body.Bio,
		OrderIndex: body.OrderIndex,
		Role:       body.Role,
	})
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(dto)
}

// updateJudge applies a partial update. Admin only.
//
//	PATCH /api/v1/hackathons/:id/judges/:judgeId
func (h *HackathonsHandler) updateJudge(c *fiber.Ctx) error {
	var body struct {
		Name       string `json:"name"`
		Title      string `json:"title"`
		AvatarURL  string `json:"avatarUrl"`
		Bio        string `json:"bio"`
		OrderIndex *int32 `json:"orderIndex"`
		Role       string `json:"role"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	dto, err := h.svc.UpdateJudge(c.Context(), c.Params("id"), c.Params("judgeId"), hackathons.UpdateJudgeInput{
		Name:       body.Name,
		Title:      body.Title,
		AvatarURL:  body.AvatarURL,
		Bio:        body.Bio,
		OrderIndex: body.OrderIndex,
		Role:       body.Role,
	})
	if err != nil {
		return err
	}
	return c.JSON(dto)
}

// removeJudge hard-deletes a judge. Admin only.
//
//	DELETE /api/v1/hackathons/:id/judges/:judgeId
func (h *HackathonsHandler) removeJudge(c *fiber.Ctx) error {
	if err := h.svc.RemoveJudge(c.Context(), c.Params("id"), c.Params("judgeId")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"message": "Judge deleted"})
}

// ============ Sponsors ============

// listSponsors returns the public sponsor list for a hackathon.
//
//	GET /api/v1/hackathons/:id/sponsors
func (h *HackathonsHandler) listSponsors(c *fiber.Ctx) error {
	rows, err := h.svc.ListSponsors(c.Context(), c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

// addSponsor inserts a new sponsor. Admin only.
//
//	POST /api/v1/hackathons/:id/sponsors
func (h *HackathonsHandler) addSponsor(c *fiber.Ctx) error {
	var body struct {
		Name       string `json:"name"`
		LogoURL    string `json:"logoUrl"`
		WebsiteURL string `json:"websiteUrl"`
		Tier       string `json:"tier"`
		OrderIndex *int32 `json:"orderIndex"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	dto, err := h.svc.AddSponsor(c.Context(), c.Params("id"), hackathons.AddSponsorInput{
		Name:       body.Name,
		LogoURL:    body.LogoURL,
		WebsiteURL: body.WebsiteURL,
		Tier:       body.Tier,
		OrderIndex: body.OrderIndex,
	})
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(dto)
}

// updateSponsor applies a partial update. Admin only.
//
//	PATCH /api/v1/hackathons/:id/sponsors/:sponsorId
func (h *HackathonsHandler) updateSponsor(c *fiber.Ctx) error {
	var body struct {
		Name       string `json:"name"`
		LogoURL    string `json:"logoUrl"`
		WebsiteURL string `json:"websiteUrl"`
		Tier       string `json:"tier"`
		OrderIndex *int32 `json:"orderIndex"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	dto, err := h.svc.UpdateSponsor(c.Context(), c.Params("id"), c.Params("sponsorId"), hackathons.UpdateSponsorInput{
		Name:       body.Name,
		LogoURL:    body.LogoURL,
		WebsiteURL: body.WebsiteURL,
		Tier:       body.Tier,
		OrderIndex: body.OrderIndex,
	})
	if err != nil {
		return err
	}
	return c.JSON(dto)
}

// removeSponsor hard-deletes a sponsor. Admin only.
//
//	DELETE /api/v1/hackathons/:id/sponsors/:sponsorId
func (h *HackathonsHandler) removeSponsor(c *fiber.Ctx) error {
	if err := h.svc.RemoveSponsor(c.Context(), c.Params("id"), c.Params("sponsorId")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"message": "Sponsor deleted"})
}
