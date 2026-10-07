import { describe, expect, test } from 'vitest';
import {
  hasNoFieldError,
  validateConfirmationCode,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateUsername
} from '@/utils/authValidator';

describe('validateUsername', () => {
  test('未入力を拒否する', () => {
    expect(validateUsername('')).toBe('ユーザー名を入力してください');
  });

  test('20文字は受け付ける', () => {
    expect(validateUsername('a'.repeat(20))).toBeNull();
  });

  test('21文字を拒否する', () => {
    expect(validateUsername('a'.repeat(21))).toBe(
      'ユーザー名は20文字以内で入力してください'
    );
  });

  test('半角の英数字記号は受け付ける', () => {
    expect(validateUsername('user_name-01!')).toBeNull();
  });

  test('全角文字を拒否する', () => {
    expect(validateUsername('やまもと')).toBe(
      'ユーザー名は半角の英数字と記号で入力してください'
    );
  });

  test('間に空白が入ったものを拒否する', () => {
    expect(validateUsername('yama moto')).toBe(
      'ユーザー名は半角の英数字と記号で入力してください'
    );
  });
});

describe('validateEmail', () => {
  test('未入力を拒否する', () => {
    expect(validateEmail('')).toBe('メールアドレスを入力してください');
  });

  test('@が無いものを拒否する', () => {
    expect(validateEmail('userexample.com')).toBe(
      'メールアドレスには@を含めてください'
    );
  });

  test('全角文字を拒否する', () => {
    expect(validateEmail('ユーザー@example.com')).toBe(
      'メールアドレスは半角の英数字と記号で入力してください'
    );
  });

  test('254文字は受け付ける', () => {
    expect(validateEmail(`${'a'.repeat(247)}@aa.com`)).toBeNull();
  });

  test('255文字を拒否する', () => {
    expect(validateEmail(`${'a'.repeat(248)}@aa.com`)).toBe(
      'メールアドレスは254文字以内で入力してください'
    );
  });

  test('通常のアドレスを受け付ける', () => {
    expect(validateEmail('user@example.com')).toBeNull();
  });
});

describe('validatePassword', () => {
  test('未入力を拒否する', () => {
    expect(validatePassword('')).toBe('パスワードを入力してください');
  });

  test('7文字を拒否する', () => {
    expect(validatePassword('Abcdef1')).toBe(
      'パスワードは8文字以上64文字以内で入力してください'
    );
  });

  test('8文字は受け付ける', () => {
    expect(validatePassword('Abcdef1!')).toBeNull();
  });

  test('64文字は受け付ける', () => {
    expect(validatePassword(`${'A1!'.repeat(21)}a`)).toBeNull();
  });

  test('65文字を拒否する', () => {
    expect(validatePassword(`${'A1!'.repeat(21)}ab`)).toBe(
      'パスワードは8文字以上64文字以内で入力してください'
    );
  });

  test('全角文字を拒否する', () => {
    expect(validatePassword('パスワード12345')).toBe(
      'パスワードは半角の英数字と記号で入力してください'
    );
  });

  test('項目名を差し替えられる', () => {
    expect(validatePassword('', '新しいパスワード')).toBe(
      '新しいパスワードを入力してください'
    );
  });
});

describe('validatePasswordConfirmation', () => {
  test('未入力を拒否する', () => {
    expect(validatePasswordConfirmation('Abcdef1!', '')).toBe(
      '確認のためパスワードをもう一度入力してください'
    );
  });

  test('一致しないものを拒否する', () => {
    expect(validatePasswordConfirmation('Abcdef1!', 'Abcdef1?')).toBe(
      'パスワードが一致しません'
    );
  });

  test('一致するものを受け付ける', () => {
    expect(validatePasswordConfirmation('Abcdef1!', 'Abcdef1!')).toBeNull();
  });

  test('項目名を差し替えられる', () => {
    expect(
      validatePasswordConfirmation('a', 'b', '新しいパスワード')
    ).toBe('新しいパスワードが一致しません');
  });
});

describe('validateConfirmationCode', () => {
  test('未入力を拒否する', () => {
    expect(validateConfirmationCode('')).toBe('確認コードを入力してください');
  });

  test('5桁を拒否する', () => {
    expect(validateConfirmationCode('12345')).toBe(
      '確認コードは半角数字6桁で入力してください'
    );
  });

  test('数字以外が混ざったものを拒否する', () => {
    expect(validateConfirmationCode('12345a')).toBe(
      '確認コードは半角数字6桁で入力してください'
    );
  });

  test('6桁の数字を受け付ける', () => {
    expect(validateConfirmationCode('123456')).toBeNull();
  });
});

describe('hasNoFieldError', () => {
  test('すべてnullならtrueを返す', () => {
    expect(hasNoFieldError({ username: null, password: null })).toBe(true);
  });

  test('1件でもエラーがあればfalseを返す', () => {
    expect(hasNoFieldError({ username: null, password: 'エラー' })).toBe(false);
  });
});
