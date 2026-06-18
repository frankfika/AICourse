"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PracticesModule = void 0;
const common_1 = require("@nestjs/common");
const practices_controller_1 = require("./practices.controller");
const practices_service_1 = require("./practices.service");
const prisma_module_1 = require("../prisma/prisma.module");
const badges_module_1 = require("../badges/badges.module");
let PracticesModule = class PracticesModule {
};
exports.PracticesModule = PracticesModule;
exports.PracticesModule = PracticesModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, badges_module_1.BadgesModule],
        controllers: [practices_controller_1.PracticesController],
        providers: [practices_service_1.PracticesService],
        exports: [practices_service_1.PracticesService],
    })
], PracticesModule);
//# sourceMappingURL=practices.module.js.map