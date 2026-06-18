"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    await prisma.$transaction([
        prisma.resource.deleteMany(),
        prisma.lesson.deleteMany(),
        prisma.chapter.deleteMany(),
        prisma.degreeCourse.deleteMany(),
        prisma.enrollment.deleteMany(),
        prisma.order.deleteMany(),
        prisma.progressRecord.deleteMany(),
        prisma.course.deleteMany(),
        prisma.nanoDegree.deleteMany(),
        prisma.refreshToken.deleteMany(),
        prisma.auditLog.deleteMany(),
        prisma.user.deleteMany(),
    ]);
    const adminPassword = await bcrypt.hash('admin123', 12);
    const admin = await prisma.user.create({
        data: {
            email: 'admin@opencsg.com',
            passwordHash: adminPassword,
            name: 'OpenCSG Admin',
            role: client_1.UserRole.admin,
            passwordResetRequired: true,
        },
    });
    const studentPassword = await bcrypt.hash('123456', 12);
    const student = await prisma.user.create({
        data: {
            email: 'student@test.com',
            passwordHash: studentPassword,
            name: '测试学员',
            role: client_1.UserRole.student,
        },
    });
    const courseInputs = [
        {
            title: '数字机密：安全基础',
            description: '好奇密码是如何工作的吗？学习如何在线保护你的数据安全。',
            learningPoints: JSON.stringify(['理解公钥与私钥加密机制', '掌握密码管理器的使用与双因素认证', '识别网络钓鱼与社会工程学攻击', '基础的网络流量分析与隐私保护']),
            instructor: 'Alice 博士',
            level: client_1.CourseLevel.Beginner,
            duration: '45 分钟',
            thumbnail: 'https://picsum.photos/seed/sec/800/400',
            tags: JSON.stringify(['安全', '适合所有人']),
            costType: client_1.CostType.free,
            price: 0,
            status: client_1.CourseStatus.published,
            chapters: {
                create: [
                    {
                        title: '第一章：安全基础',
                        description: '了解基本安全概念',
                        orderIndex: 0,
                        lessons: {
                            create: [
                                {
                                    title: '1.1 为什么安全很重要',
                                    description: '介绍数字安全的重要性',
                                    videoUrl: 'https://www.youtube.com/embed/36YgDDJ7Xsc',
                                    orderIndex: 0,
                                    isPreview: true,
                                    resources: {
                                        create: [
                                            { title: '安全检查清单', url: '#', type: 'pdf' },
                                        ],
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        },
        {
            title: '全民 AI',
            description: '揭开人工智能的神秘面纱。',
            learningPoints: JSON.stringify(['大型语言模型 (LLM) 的基本原理', '提示词工程 (Prompt Engineering) 入门', 'AI 在创意写作与图像生成中的应用', '人工智能的局限性与偏见']),
            instructor: 'Sarah C.',
            level: client_1.CourseLevel.Beginner,
            duration: '60 分钟',
            thumbnail: 'https://picsum.photos/seed/ai-easy/800/400',
            tags: JSON.stringify(['AI', '概念', '未来']),
            costType: client_1.CostType.free,
            price: 0,
            status: client_1.CourseStatus.published,
        },
        {
            title: '构建你的第一个网站',
            description: '在互联网上创造属于你的一角。',
            learningPoints: JSON.stringify(['HTML5 语义化标签结构', 'CSS3 布局与 Flexbox', '响应式设计基础 (Mobile First)', '使用 Git 进行版本控制与部署']),
            instructor: 'Neo',
            level: client_1.CourseLevel.Beginner,
            duration: '45 分钟',
            thumbnail: 'https://picsum.photos/seed/web/800/400',
            tags: JSON.stringify(['创意', '设计', 'Web']),
            costType: client_1.CostType.paid,
            price: 49.99,
            status: client_1.CourseStatus.published,
        },
        {
            title: 'Python：友好的编程语言',
            description: '用 Python 开启你的编程之旅。',
            learningPoints: JSON.stringify(['Python 基础语法与变量', '控制流：循环与条件判断', '函数式编程初步', '使用第三方库处理文件与网络请求']),
            instructor: 'Guido',
            level: client_1.CourseLevel.Beginner,
            duration: '90 分钟',
            thumbnail: 'https://picsum.photos/seed/python/800/400',
            tags: JSON.stringify(['编程', 'Python', '逻辑']),
            costType: client_1.CostType.paid,
            price: 59.99,
            status: client_1.CourseStatus.published,
        },
        {
            title: '白帽黑客：数字防御',
            description: '通过了解黑客的思维方式来保护自己。',
            learningPoints: JSON.stringify(['Linux 命令行基础', '常见 Web 漏洞 (SQL 注入, XSS)', '网络嗅探与分析', '道德黑客的法律边界']),
            instructor: 'Mr. Robot',
            level: client_1.CourseLevel.Intermediate,
            duration: '55 分钟',
            thumbnail: 'https://picsum.photos/seed/hack/800/400',
            tags: JSON.stringify(['安全', '防御']),
            costType: client_1.CostType.paid,
            price: 79.99,
            status: client_1.CourseStatus.published,
        },
        {
            title: '云图：理解云计算',
            description: '你的照片到底存哪儿了？了解驱动现代世界的全球计算机网络。',
            learningPoints: JSON.stringify(['IaaS, PaaS, SaaS 的区别', '虚拟化与容器技术 (Docker 简介)', '无服务器架构 (Serverless)', '云端数据库与存储']),
            instructor: 'Sky Walker',
            level: client_1.CourseLevel.Beginner,
            duration: '30 分钟',
            thumbnail: 'https://picsum.photos/seed/cloud/800/400',
            tags: JSON.stringify(['基础设施', '概念']),
            costType: client_1.CostType.free,
            price: 0,
            status: client_1.CourseStatus.published,
        },
    ];
    const courses = [];
    for (const data of courseInputs) {
        const course = await prisma.course.create({ data });
        courses.push(course);
    }
    const degreeInputs = [
        {
            title: '数字安全卫士',
            description: '成为每个人都信赖的技术守护者。',
            learningPoints: JSON.stringify(['构建个人与企业的数字防御体系', '掌握基础渗透测试工具', '分析并响应网络安全事件', '获得 OpenCSG 认证初级安全分析师资格']),
            price: 399,
            icon: 'shield',
            costType: client_1.CostType.paid,
            status: client_1.CourseStatus.published,
        },
        {
            title: '未来科技探索者',
            description: '从理解 AI 到编写你的第一行代码。',
            learningPoints: JSON.stringify(['熟练使用 Generative AI 工具提升效率', '掌握 Python 编程基础', '理解云计算与互联网基础设施', '培养计算思维与解决问题的能力']),
            price: 499,
            icon: 'sparkles',
            costType: client_1.CostType.paid,
            status: client_1.CourseStatus.published,
        },
    ];
    const degrees = [];
    for (const data of degreeInputs) {
        const degree = await prisma.nanoDegree.create({ data });
        degrees.push(degree);
    }
    await prisma.degreeCourse.createMany({
        data: [
            { degreeId: degrees[0].id, courseId: courses[0].id, orderIndex: 0 },
            { degreeId: degrees[0].id, courseId: courses[4].id, orderIndex: 1 },
            { degreeId: degrees[1].id, courseId: courses[1].id, orderIndex: 0 },
            { degreeId: degrees[1].id, courseId: courses[3].id, orderIndex: 1 },
            { degreeId: degrees[1].id, courseId: courses[5].id, orderIndex: 2 },
        ],
    });
    console.log('✅ Seed completed');
    console.log(`Admin: ${admin.email}`);
    console.log(`Student: ${student.email}`);
    console.log(`Courses: ${courses.length}`);
    console.log(`Degrees: ${degrees.length}`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map