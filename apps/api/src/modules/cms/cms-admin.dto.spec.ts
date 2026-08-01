import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateQuickPromptDto } from './cms-admin.dto';

describe('CreateQuickPromptDto', () => {
  it('accepts the QuickPrompt database fields used by the admin UI', async () => {
    const dto = plainToInstance(CreateQuickPromptDto, {
      emoji: '💡',
      label: '解释课程',
      promptText: '请解释本节课的核心概念',
      scope: 'lesson',
      isActive: true,
      orderIndex: 2,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects the obsolete prompt/key payload shape', async () => {
    const dto = plainToInstance(CreateQuickPromptDto, {
      key: 'explain',
      label: '解释课程',
      prompt: '旧字段',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'promptText')).toBe(true);
  });
});
