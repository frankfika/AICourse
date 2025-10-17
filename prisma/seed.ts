import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Create Categories
  console.log('Creating categories...')
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: '机器学习',
        slug: 'machine-learning',
        description: '学习机器学习的基础理论和实践应用',
        order: 1,
      },
    }),
    prisma.category.create({
      data: {
        name: '深度学习',
        slug: 'deep-learning',
        description: '深入了解神经网络和深度学习技术',
        order: 2,
      },
    }),
    prisma.category.create({
      data: {
        name: '自然语言处理',
        slug: 'nlp',
        description: '掌握 NLP 技术和语言模型',
        order: 3,
      },
    }),
    prisma.category.create({
      data: {
        name: '计算机视觉',
        slug: 'computer-vision',
        description: '学习图像识别和计算机视觉算法',
        order: 4,
      },
    }),
    prisma.category.create({
      data: {
        name: '强化学习',
        slug: 'reinforcement-learning',
        description: '探索智能体学习和决策优化',
        order: 5,
      },
    }),
  ])

  // Create Instructors
  console.log('Creating instructors...')
  const instructors = await Promise.all([
    prisma.instructor.create({
      data: {
        name: '张教授',
        email: 'zhang@courseai.com',
        avatar: '/images/instructors/zhang.jpg',
        title: 'AI 研究员 & 教授',
        bio: '清华大学计算机系教授，专注于机器学习和深度学习研究 15 年',
        experience: '曾在 Google AI 和微软研究院工作，发表论文 50+ 篇',
        socialLinks: JSON.stringify({
          linkedin: 'https://linkedin.com/in/zhang',
          github: 'https://github.com/zhang',
        }),
      },
    }),
    prisma.instructor.create({
      data: {
        name: 'Dr. Li',
        email: 'li@courseai.com',
        avatar: '/images/instructors/li.jpg',
        title: 'NLP 专家',
        bio: '斯坦福大学博士，专注于自然语言处理和大语言模型',
        experience: '在 OpenAI 担任研究科学家，参与 GPT 系列模型开发',
        socialLinks: JSON.stringify({
          twitter: 'https://twitter.com/drli',
          github: 'https://github.com/drli',
        }),
      },
    }),
    prisma.instructor.create({
      data: {
        name: '王老师',
        email: 'wang@courseai.com',
        avatar: '/images/instructors/wang.jpg',
        title: '计算机视觉工程师',
        bio: 'MIT 计算机视觉实验室博士后，擅长图像识别和目标检测',
        experience: '曾在特斯拉自动驾驶团队工作 5 年',
        socialLinks: JSON.stringify({
          linkedin: 'https://linkedin.com/in/wang',
        }),
      },
    }),
    prisma.instructor.create({
      data: {
        name: 'Sarah Chen',
        email: 'sarah@courseai.com',
        avatar: '/images/instructors/sarah.jpg',
        title: '深度学习架构师',
        bio: 'Carnegie Mellon 大学博士，深度学习框架核心贡献者',
        experience: '在 Facebook AI Research 工作 6 年，PyTorch 核心开发者',
        socialLinks: JSON.stringify({
          github: 'https://github.com/sarahchen',
          twitter: 'https://twitter.com/sarahchen',
        }),
      },
    }),
  ])

  // Create Courses
  console.log('Creating courses...')
  
  const course1 = await prisma.course.create({
    data: {
      title: '机器学习入门：从零到实战',
      slug: 'intro-to-machine-learning',
      shortDescription: '系统学习机器学习基础知识，掌握常见算法和实际应用',
      description: '<p>这是一门全面的机器学习入门课程，适合零基础学员。课程涵盖监督学习、无监督学习、模型评估等核心概念。</p><p>通过实际项目练习，你将掌握使用 Python 和 scikit-learn 进行数据分析和模型训练的技能。</p>',
      coverImage: '/images/courses/ml-intro.jpg',
      duration: 180,
      level: 'beginner',
      categoryId: categories[0].id,
      instructorId: instructors[0].id,
      prerequisites: JSON.stringify(['Python 基础', '基础数学知识']),
      learningObjectives: JSON.stringify([
        '理解机器学习的基本概念和工作原理',
        '掌握常见机器学习算法的使用',
        '能够独立完成数据预处理和特征工程',
        '学会评估和优化模型性能',
      ]),
      highlights: JSON.stringify([
        '10+ 个实战项目',
        '配套 Jupyter Notebook',
        '完整的代码示例',
      ]),
      targetAudience: '对AI感兴趣的初学者、数据分析师、软件工程师',
      suggestedWeeks: 6,
      hoursPerWeek: 5,
      viewCount: 1250,
      enrollCount: 450,
      featured: true,
      status: 'published',
    },
  })

  // Add chapters for course1
  await Promise.all([
    prisma.chapter.create({
      data: {
        courseId: course1.id,
        title: '机器学习概述',
        duration: 30,
        topics: JSON.stringify(['什么是机器学习', 'AI、ML、DL 的区别', '应用场景']),
        order: 1,
      },
    }),
    prisma.chapter.create({
      data: {
        courseId: course1.id,
        title: '监督学习：回归',
        duration: 45,
        topics: JSON.stringify(['线性回归', '多项式回归', '正则化']),
        order: 2,
      },
    }),
    prisma.chapter.create({
      data: {
        courseId: course1.id,
        title: '监督学习：分类',
        duration: 50,
        topics: JSON.stringify(['逻辑回归', '决策树', '随机森林', 'SVM']),
        order: 3,
      },
    }),
    prisma.chapter.create({
      data: {
        courseId: course1.id,
        title: '无监督学习',
        duration: 40,
        topics: JSON.stringify(['K-means 聚类', '层次聚类', 'PCA 降维']),
        order: 4,
      },
    }),
    prisma.chapter.create({
      data: {
        courseId: course1.id,
        title: '模型评估与优化',
        duration: 15,
        topics: JSON.stringify(['交叉验证', '超参数调优', '模型集成']),
        order: 5,
      },
    }),
  ])

  // Add FAQs for course1
  await Promise.all([
    prisma.courseFAQ.create({
      data: {
        courseId: course1.id,
        question: '需要什么基础？',
        answer: '<p>需要基本的 Python 编程能力和高中数学知识。不需要有机器学习经验。</p>',
        order: 1,
      },
    }),
    prisma.courseFAQ.create({
      data: {
        courseId: course1.id,
        question: '课程时长是多少？',
        answer: '<p>课程总时长约 180 分钟，建议分 6 周学完，每周学习 5 小时。</p>',
        order: 2,
      },
    }),
  ])

  // Create more courses...
  const course2 = await prisma.course.create({
    data: {
      title: '深度学习与神经网络',
      slug: 'deep-learning-neural-networks',
      shortDescription: '深入理解神经网络原理，掌握深度学习核心技术',
      description: '<p>本课程将带你深入探索深度学习的世界。从神经网络的基本原理开始，逐步学习卷积神经网络、循环神经网络等高级架构。</p><p>课程包含大量实战项目，使用 TensorFlow 和 PyTorch 构建真实的深度学习应用。</p>',
      coverImage: '/images/courses/deep-learning.jpg',
      duration: 240,
      level: 'intermediate',
      categoryId: categories[1].id,
      instructorId: instructors[3].id,
      prerequisites: JSON.stringify(['机器学习基础', 'Python 编程', '线性代数']),
      learningObjectives: JSON.stringify([
        '理解神经网络的数学原理',
        '掌握反向传播算法',
        '能够使用深度学习框架构建模型',
        '了解各种神经网络架构的应用场景',
      ]),
      highlights: JSON.stringify([
        '使用 TensorFlow 和 PyTorch',
        '15+ 个项目实战',
        '涵盖 CNN、RNN、Transformer',
      ]),
      targetAudience: '有机器学习基础的工程师、研究人员',
      suggestedWeeks: 8,
      hoursPerWeek: 6,
      viewCount: 980,
      enrollCount: 320,
      featured: true,
      status: 'published',
    },
  })

  await Promise.all([
    prisma.chapter.create({
      data: {
        courseId: course2.id,
        title: '神经网络基础',
        duration: 40,
        topics: JSON.stringify(['感知机', '多层神经网络', '激活函数']),
        order: 1,
      },
    }),
    prisma.chapter.create({
      data: {
        courseId: course2.id,
        title: '反向传播与优化',
        duration: 50,
        topics: JSON.stringify(['梯度下降', 'Adam 优化器', '学习率调度']),
        order: 2,
      },
    }),
    prisma.chapter.create({
      data: {
        courseId: course2.id,
        title: '卷积神经网络 (CNN)',
        duration: 60,
        topics: JSON.stringify(['卷积层', '池化层', '经典 CNN 架构']),
        order: 3,
      },
    }),
    prisma.chapter.create({
      data: {
        courseId: course2.id,
        title: '循环神经网络 (RNN)',
        duration: 50,
        topics: JSON.stringify(['RNN 基础', 'LSTM', 'GRU']),
        order: 4,
      },
    }),
    prisma.chapter.create({
      data: {
        courseId: course2.id,
        title: '深度学习实践技巧',
        duration: 40,
        topics: JSON.stringify(['正则化', 'Dropout', '批量归一化']),
        order: 5,
      },
    }),
  ])

  // Course 3
  const course3 = await prisma.course.create({
    data: {
      title: 'NLP 实战：从 Word2Vec 到 BERT',
      slug: 'nlp-practical-guide',
      shortDescription: '系统学习自然语言处理技术，掌握现代 NLP 模型',
      description: '<p>本课程全面介绍自然语言处理的核心技术。从词嵌入开始，逐步学习 LSTM、Attention 机制、Transformer 架构，最后深入 BERT 等预训练模型。</p>',
      coverImage: '/images/courses/nlp.jpg',
      duration: 200,
      level: 'intermediate',
      categoryId: categories[2].id,
      instructorId: instructors[1].id,
      prerequisites: JSON.stringify(['Python 编程', '深度学习基础']),
      learningObjectives: JSON.stringify([
        '理解词嵌入和语言模型',
        '掌握 Transformer 架构',
        '能够使用 BERT 进行文本分类',
        '了解最新的 NLP 研究进展',
      ]),
      highlights: JSON.stringify([
        '使用 Hugging Face Transformers',
        '实战项目：情感分析、问答系统',
        '涵盖 GPT、BERT、T5',
      ]),
      targetAudience: '对 NLP 感兴趣的工程师、数据科学家',
      suggestedWeeks: 7,
      hoursPerWeek: 5,
      viewCount: 856,
      enrollCount: 278,
      featured: true,
      status: 'published',
    },
  })

  // Continue creating more courses...
  const courses = [course1, course2, course3]
  
  // Create additional courses to reach 12-15 total
  const additionalCourses = await Promise.all([
    prisma.course.create({
      data: {
        title: '计算机视觉：图像识别与目标检测',
        slug: 'computer-vision-fundamentals',
        shortDescription: '学习图像处理、目标检测和图像分割技术',
        description: '<p>深入学习计算机视觉的核心算法，从传统图像处理到现代深度学习方法。</p>',
        coverImage: '/images/courses/cv.jpg',
        duration: 220,
        level: 'intermediate',
        categoryId: categories[3].id,
        instructorId: instructors[2].id,
        prerequisites: JSON.stringify(['深度学习基础', 'Python']),
        learningObjectives: JSON.stringify([
          '掌握图像处理基础',
          '理解 CNN 在视觉任务中的应用',
          '学会使用 YOLO、Faster R-CNN',
        ]),
        highlights: JSON.stringify(['实战项目', '代码示例', '最新模型']),
        targetAudience: 'AI 工程师、研究人员',
        suggestedWeeks: 8,
        hoursPerWeek: 5,
        viewCount: 723,
        enrollCount: 245,
        featured: false,
        status: 'published',
      },
    }),
    prisma.course.create({
      data: {
        title: '强化学习入门',
        slug: 'reinforcement-learning-intro',
        shortDescription: '学习智能体如何通过与环境交互来学习最优策略',
        description: '<p>本课程介绍强化学习的基本概念和算法，包括 Q-Learning、Policy Gradient 等。</p>',
        coverImage: '/images/courses/rl.jpg',
        duration: 150,
        level: 'advanced',
        categoryId: categories[4].id,
        instructorId: instructors[0].id,
        prerequisites: JSON.stringify(['机器学习', '概率论']),
        learningObjectives: JSON.stringify([
          '理解 MDP 和 Bellman 方程',
          '掌握 Q-Learning 和 DQN',
          '学习 Policy Gradient 方法',
        ]),
        highlights: JSON.stringify(['OpenAI Gym', '游戏 AI', '实战项目']),
        targetAudience: '有 ML 基础的研究人员',
        suggestedWeeks: 6,
        hoursPerWeek: 4,
        viewCount: 567,
        enrollCount: 189,
        featured: false,
        status: 'published',
      },
    }),
    // Add more courses...
    prisma.course.create({
      data: {
        title: 'PyTorch 实战教程',
        slug: 'pytorch-practical-tutorial',
        shortDescription: '从零开始学习 PyTorch 深度学习框架',
        description: '<p>完整的 PyTorch 教程，涵盖张量操作、自动微分、模型构建和训练。</p>',
        coverImage: '/images/courses/pytorch.jpg',
        duration: 120,
        level: 'beginner',
        categoryId: categories[1].id,
        instructorId: instructors[3].id,
        prerequisites: JSON.stringify(['Python 基础']),
        learningObjectives: JSON.stringify([
          '掌握 PyTorch 基本操作',
          '能够构建神经网络模型',
          '了解模型训练流程',
        ]),
        highlights: JSON.stringify(['实用示例', '最佳实践', '项目驱动']),
        targetAudience: '深度学习初学者',
        suggestedWeeks: 4,
        hoursPerWeek: 5,
        viewCount: 892,
        enrollCount: 356,
        featured: false,
        status: 'published',
      },
    }),
    prisma.course.create({
      data: {
        title: 'TensorFlow 2.0 完全指南',
        slug: 'tensorflow-complete-guide',
        shortDescription: '全面学习 TensorFlow 2.0 深度学习框架',
        description: '<p>从基础到高级，系统学习 TensorFlow 2.0 的各个方面。</p>',
        coverImage: '/images/courses/tensorflow.jpg',
        duration: 130,
        level: 'beginner',
        categoryId: categories[1].id,
        instructorId: instructors[0].id,
        prerequisites: JSON.stringify(['Python 编程']),
        learningObjectives: JSON.stringify([
          '掌握 TensorFlow Keras API',
          '学会模型部署',
          '了解 TensorFlow Serving',
        ]),
        highlights: JSON.stringify(['Keras API', '模型部署', '生产实践']),
        targetAudience: 'ML 工程师',
        suggestedWeeks: 5,
        hoursPerWeek: 4,
        viewCount: 645,
        enrollCount: 234,
        featured: false,
        status: 'published',
      },
    }),
  ])

  courses.push(...additionalCourses)

  // Create Nano Degrees
  console.log('Creating nano degrees...')
  
  const nanodegree1 = await prisma.nanoDegree.create({
    data: {
      title: 'AI 工程师认证课程',
      slug: 'ai-engineer-nanodegree',
      shortDescription: '从零到一成为 AI 工程师，掌握完整的 AI 技术栈',
      description: '<p>这是一个全面的 AI 工程师培养计划，涵盖机器学习、深度学习、NLP 和计算机视觉等核心领域。</p><p>通过系统学习和项目实战，你将具备独立开发 AI 应用的能力。</p>',
      coverImage: '/images/nanodegrees/ai-engineer.jpg',
      level: 'intermediate',
      certificateImage: '/images/certificates/ai-engineer.jpg',
      certificateDescription: 'AI 工程师专业认证',
      certificateType: 'Professional Certificate',
      completionCriteria: '完成所有课程学习并通过项目考核',
      learningPath: '<p>按照推荐顺序学习，从机器学习基础开始，逐步深入到深度学习和专业领域。</p>',
      skills: JSON.stringify(['机器学习', '深度学习', 'Python', 'TensorFlow', 'PyTorch']),
      highlights: JSON.stringify([
        '4 门核心课程',
        '总计 740 分钟学习内容',
        '多个实战项目',
        '行业认可的证书',
      ]),
      targetAudience: '想要转行 AI 的工程师、在校学生',
      prerequisites: JSON.stringify(['Python 基础', '基础数学']),
      suggestedMonths: 4,
      hoursPerWeek: 10,
      viewCount: 456,
      enrollCount: 156,
      featured: true,
      status: 'published',
    },
  })

  // Link courses to nanodegree1
  await Promise.all([
    prisma.nanoDegreeCourse.create({
      data: {
        nanoDegreeId: nanodegree1.id,
        courseId: courses[0].id, // ML intro
        order: 1,
      },
    }),
    prisma.nanoDegreeCourse.create({
      data: {
        nanoDegreeId: nanodegree1.id,
        courseId: courses[1].id, // Deep Learning
        order: 2,
      },
    }),
    prisma.nanoDegreeCourse.create({
      data: {
        nanoDegreeId: nanodegree1.id,
        courseId: courses[2].id, // NLP
        order: 3,
      },
    }),
    prisma.nanoDegreeCourse.create({
      data: {
        nanoDegreeId: nanodegree1.id,
        courseId: courses[3].id, // CV
        order: 4,
      },
    }),
  ])

  await Promise.all([
    prisma.nanoDegreeFAQ.create({
      data: {
        nanoDegreeId: nanodegree1.id,
        question: '完成 Nano Degree 需要多长时间？',
        answer: '<p>建议 4 个月完成，每周学习 10 小时。你也可以根据自己的节奏调整。</p>',
        order: 1,
      },
    }),
    prisma.nanoDegreeFAQ.create({
      data: {
        nanoDegreeId: nanodegree1.id,
        question: '证书是否被行业认可？',
        answer: '<p>是的，我们的证书被众多科技公司认可，可以作为求职的加分项。</p>',
        order: 2,
      },
    }),
  ])

  // Create more nano degrees...
  const nanodegree2 = await prisma.nanoDegree.create({
    data: {
      title: 'NLP 专家认证',
      slug: 'nlp-specialist-nanodegree',
      shortDescription: '深入学习自然语言处理，成为 NLP 领域专家',
      description: '<p>专注于 NLP 领域的深度课程，从基础到前沿技术全覆盖。</p>',
      coverImage: '/images/nanodegrees/nlp-specialist.jpg',
      level: 'advanced',
      certificateImage: '/images/certificates/nlp-specialist.jpg',
      certificateDescription: 'NLP 专家认证',
      certificateType: 'Specialist Certificate',
      completionCriteria: '完成所有 NLP 相关课程并完成毕业项目',
      learningPath: '<p>系统学习 NLP 技术栈，掌握大语言模型应用。</p>',
      skills: JSON.stringify(['NLP', 'BERT', 'GPT', 'Transformers', 'Text Mining']),
      highlights: JSON.stringify([
        '专注 NLP 领域',
        '涵盖最新技术',
        '大语言模型实战',
      ]),
      targetAudience: '想要深入 NLP 的工程师',
      prerequisites: JSON.stringify(['深度学习基础']),
      suggestedMonths: 3,
      hoursPerWeek: 8,
      viewCount: 312,
      enrollCount: 98,
      featured: false,
      status: 'published',
    },
  })

  await prisma.nanoDegreeCourse.create({
    data: {
      nanoDegreeId: nanodegree2.id,
      courseId: courses[2].id, // NLP course
      order: 1,
    },
  })

  const nanodegree3 = await prisma.nanoDegree.create({
    data: {
      title: '深度学习大师课程',
      slug: 'deep-learning-master',
      shortDescription: '成为深度学习专家，掌握最前沿的神经网络技术',
      description: '<p>深度学习的完整学习路径，适合想要深入研究的学员。</p>',
      coverImage: '/images/nanodegrees/dl-master.jpg',
      level: 'advanced',
      certificateImage: '/images/certificates/dl-master.jpg',
      certificateDescription: '深度学习大师认证',
      certificateType: 'Master Certificate',
      completionCriteria: '完成所有深度学习课程及高级项目',
      learningPath: '<p>从基础到高级，全面掌握深度学习技术。</p>',
      skills: JSON.stringify(['Deep Learning', 'CNN', 'RNN', 'GAN', 'Transfer Learning']),
      highlights: JSON.stringify([
        '涵盖所有神经网络架构',
        '前沿研究介绍',
        '论文阅读指导',
      ]),
      targetAudience: '研究人员、高级工程师',
      prerequisites: JSON.stringify(['机器学习', '线性代数']),
      suggestedMonths: 5,
      hoursPerWeek: 12,
      viewCount: 289,
      enrollCount: 76,
      featured: true,
      status: 'published',
    },
  })

  await Promise.all([
    prisma.nanoDegreeCourse.create({
      data: {
        nanoDegreeId: nanodegree3.id,
        courseId: courses[1].id, // Deep Learning
        order: 1,
      },
    }),
    prisma.nanoDegreeCourse.create({
      data: {
        nanoDegreeId: nanodegree3.id,
        courseId: courses[5].id, // PyTorch
        order: 2,
      },
    }),
  ])

  // Create Banners
  console.log('Creating banners...')
  await Promise.all([
    prisma.banner.create({
      data: {
        title: '2024 AI 学习季',
        image: '/images/banners/banner1.jpg',
        link: '/courses',
        openInNewTab: false,
        isActive: true,
        order: 1,
      },
    }),
    prisma.banner.create({
      data: {
        title: '新课程上线：NLP 实战',
        image: '/images/banners/banner2.jpg',
        link: '/courses/nlp-practical-guide',
        openInNewTab: false,
        isActive: true,
        order: 2,
      },
    }),
    prisma.banner.create({
      data: {
        title: 'Nano Degree 认证计划',
        image: '/images/banners/banner3.jpg',
        link: '/nano-degrees',
        openInNewTab: false,
        isActive: true,
        order: 3,
      },
    }),
  ])

  // Create Site Config
  console.log('Creating site config...')
  await prisma.siteConfig.create({
    data: {
      key: 'site_info',
      value: JSON.stringify({
        name: 'CourseAI',
        slogan: '开启你的 AI 学习之旅',
        about: '专注于 AI 教育的在线学习平台',
        email: 'contact@courseai.com',
        social: {
          wechat: '/images/qr-wechat.jpg',
          twitter: 'https://twitter.com/courseai',
          github: 'https://github.com/courseai',
        },
      }),
    },
  })

  // Create Admin User
  console.log('Creating admin user...')
  const hashedPassword = await bcrypt.hash('admin123', 10)
  await prisma.admin.create({
    data: {
      username: 'admin',
      email: 'admin@courseai.com',
      passwordHash: hashedPassword,
      name: '管理员',
      role: 'super_admin',
    },
  })

  console.log('✅ Seed completed successfully!')
  console.log('\n📊 Created:')
  console.log(`  - ${categories.length} categories`)
  console.log(`  - ${instructors.length} instructors`)
  console.log(`  - ${courses.length} courses`)
  console.log('  - 3 nano degrees')
  console.log('  - 3 banners')
  console.log('  - 1 admin user (username: admin, password: admin123)')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

