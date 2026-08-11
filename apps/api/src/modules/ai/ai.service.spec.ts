import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { AiProviderService } from '../../common/ai-provider/ai-provider.service';
import { AiService } from './ai.service';

const courseDraft = {
  title: 'RAG 系统实战',
  description: '从检索到评测，完成一套可运行的 RAG 系统。',
  learningPoints: '理解检索流程\n完成端到端项目',
  instructor: '平台教研团队',
  level: 'Advanced',
  duration: '4 小时',
  tags: 'RAG,LLM',
  thumbnail: '',
  costType: 'paid',
  price: 199,
  courseType: 'own',
  externalUrl: '',
};

const degreeDraft = {
  title: 'AI 全栈工程师',
  description: '覆盖模型应用、工程交付与上线运维的体系化学习路径。',
  learningPoints: '构建模型应用\n完成工程交付',
  icon: 'sparkles',
  costType: 'paid',
  price: 1999,
  thumbnail: '',
  tags: 'AI,工程',
};

describe('AiService', () => {
  let service: AiService;
  let generateText: jest.Mock;

  beforeEach(async () => {
    generateText = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: AiProviderService, useValue: { generateText } },
      ],
    }).compile();
    service = module.get(AiService);
  });

  it('returns a schema-validated course draft from the configured provider', async () => {
    generateText.mockResolvedValue(JSON.stringify(courseDraft));
    await expect(service.generateCourse('RAG 系统实战')).resolves.toEqual(courseDraft);
  });

  it('returns a schema-validated degree draft from the configured provider', async () => {
    generateText.mockResolvedValue(`\`\`\`json\n${JSON.stringify(degreeDraft)}\n\`\`\``);
    await expect(service.generateDegree('AI 全栈工程师')).resolves.toEqual(degreeDraft);
  });

  it('exposes provider outages instead of fabricating a rule-based draft', async () => {
    generateText.mockRejectedValue(new ServiceUnavailableException('未配置可用的 AI Provider'));
    await expect(service.generateCourse('RAG')).rejects.toThrow(ServiceUnavailableException);
  });

  it('rejects empty provider output', async () => {
    generateText.mockResolvedValue('');
    await expect(service.generateCourse('RAG')).rejects.toThrow(BadGatewayException);
  });

  it('rejects malformed or incomplete provider output', async () => {
    generateText.mockResolvedValue('{"title":"只有标题"}');
    await expect(service.generateDegree('AI')).rejects.toThrow(BadGatewayException);
  });
});
