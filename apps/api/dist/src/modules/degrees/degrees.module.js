"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DegreesModule = void 0;
const common_1 = require("@nestjs/common");
const degrees_controller_1 = require("./degrees.controller");
const degrees_service_1 = require("./degrees.service");
let DegreesModule = class DegreesModule {
};
exports.DegreesModule = DegreesModule;
exports.DegreesModule = DegreesModule = __decorate([
    (0, common_1.Module)({
        controllers: [degrees_controller_1.DegreesController],
        providers: [degrees_service_1.DegreesService],
        exports: [degrees_service_1.DegreesService],
    })
], DegreesModule);
//# sourceMappingURL=degrees.module.js.map