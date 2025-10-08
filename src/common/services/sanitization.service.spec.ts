import { Test, TestingModule } from '@nestjs/testing';
import { SanitizationService } from './sanitization.service';

describe('SanitizationService', () => {
  let service: SanitizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SanitizationService],
    }).compile();

    service = module.get<SanitizationService>(SanitizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sanitizeHtml', () => {
    describe('strict mode', () => {
      it('should remove all HTML tags', () => {
        const input = '<p>Hello <b>World</b></p>';
        const result = service.sanitizeHtml(input, 'strict');
        expect(result).toBe('Hello World');
      });

      it('should remove script tags and content', () => {
        const input = '<script>alert("XSS")</script>Hello';
        const result = service.sanitizeHtml(input, 'strict');
        expect(result).toBe('Hello');
      });

      it('should remove event handlers', () => {
        const input = '<div onclick="alert(1)">Click me</div>';
        const result = service.sanitizeHtml(input, 'strict');
        expect(result).toBe('Click me');
      });

      it('should handle empty string', () => {
        expect(service.sanitizeHtml('', 'strict')).toBe('');
      });

      it('should handle null/undefined', () => {
        expect(service.sanitizeHtml(null as any, 'strict')).toBe('');
        expect(service.sanitizeHtml(undefined as any, 'strict')).toBe('');
      });

      it('should remove iframe tags', () => {
        const input = '<iframe src="https://evil.com"></iframe>Content';
        const result = service.sanitizeHtml(input, 'strict');
        expect(result).toBe('Content');
      });

      it('should remove style tags', () => {
        const input = '<style>body { display: none; }</style>Text';
        const result = service.sanitizeHtml(input, 'strict');
        expect(result).toBe('Text');
      });
    });

    describe('moderate mode', () => {
      it('should allow basic formatting tags', () => {
        const input = '<p>Hello <b>World</b></p>';
        const result = service.sanitizeHtml(input, 'moderate');
        expect(result).toContain('<b>');
        expect(result).toContain('World');
      });

      it('should still remove script tags', () => {
        const input = '<p>Text</p><script>alert(1)</script>';
        const result = service.sanitizeHtml(input, 'moderate');
        expect(result).not.toContain('<script>');
        expect(result).toContain('<p>Text</p>');
      });

      it('should allow safe links', () => {
        const input = '<a href="https://example.com">Link</a>';
        const result = service.sanitizeHtml(input, 'moderate');
        expect(result).toContain('href="https://example.com"');
      });

      it('should remove javascript: protocol links', () => {
        const input = '<a href="javascript:alert(1)">Click</a>';
        const result = service.sanitizeHtml(input, 'moderate');
        expect(result).not.toContain('javascript:');
      });

      it('should allow lists', () => {
        const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
        const result = service.sanitizeHtml(input, 'moderate');
        expect(result).toContain('<ul>');
        expect(result).toContain('<li>');
      });
    });

    describe('rich mode', () => {
      it('should allow headings', () => {
        const input = '<h1>Title</h1><h2>Subtitle</h2>';
        const result = service.sanitizeHtml(input, 'rich');
        expect(result).toContain('<h1>Title</h1>');
        expect(result).toContain('<h2>Subtitle</h2>');
      });

      it('should allow images with safe protocols', () => {
        const input = '<img src="https://example.com/image.jpg" alt="Test">';
        const result = service.sanitizeHtml(input, 'rich');
        expect(result).toContain('<img');
        expect(result).toContain('src="https://example.com/image.jpg"');
      });

      it('should allow tables', () => {
        const input = '<table><tr><td>Cell</td></tr></table>';
        const result = service.sanitizeHtml(input, 'rich');
        expect(result).toContain('<table>');
        expect(result).toContain('<td>Cell</td>');
      });

      it('should still remove iframes', () => {
        const input = '<h1>Title</h1><iframe src="evil.com"></iframe>';
        const result = service.sanitizeHtml(input, 'rich');
        expect(result).not.toContain('<iframe>');
        expect(result).toContain('<h1>Title</h1>');
      });
    });
  });

  describe('sanitizeForDatabase', () => {
    it('should remove SQL injection patterns', () => {
      const input = "Robert'; DROP TABLE users;--";
      const result = service.sanitizeForDatabase(input);
      expect(result).not.toContain("'");
      expect(result).not.toContain(';');
      expect(result).not.toContain('--');
    });

    it('should remove UNION SELECT attacks', () => {
      const input = "test' UNION SELECT * FROM users--";
      const result = service.sanitizeForDatabase(input);
      expect(result.toLowerCase()).not.toContain('union');
      expect(result.toLowerCase()).not.toContain('select');
    });

    it('should remove INSERT INTO patterns', () => {
      const input = "test'; INSERT INTO users VALUES('hacker')--";
      const result = service.sanitizeForDatabase(input);
      expect(result.toLowerCase()).not.toContain('insert');
    });

    it('should remove DELETE FROM patterns', () => {
      const input = "test'; DELETE FROM users WHERE 1=1--";
      const result = service.sanitizeForDatabase(input);
      expect(result.toLowerCase()).not.toContain('delete');
    });

    it('should remove DROP TABLE patterns', () => {
      const input = "test'; DROP TABLE users;--";
      const result = service.sanitizeForDatabase(input);
      expect(result.toLowerCase()).not.toContain('drop');
    });

    it('should remove stored procedure calls', () => {
      const input = "test'; EXEC sp_executesql--";
      const result = service.sanitizeForDatabase(input);
      expect(result.toLowerCase()).not.toContain('sp_');
      // Should remove standalone EXEC keyword
      expect(result.toLowerCase()).not.toMatch(/\bexec\b/);
      // Note: 'executesql' function name is preserved as it's part of a longer word
    });

    it('should handle empty string', () => {
      expect(service.sanitizeForDatabase('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(service.sanitizeForDatabase(null as any)).toBe('');
      expect(service.sanitizeForDatabase(undefined as any)).toBe('');
    });

    it('should preserve safe text', () => {
      const input = 'John Doe 123';
      const result = service.sanitizeForDatabase(input);
      expect(result).toContain('John Doe');
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove directory traversal', () => {
      const input = '../../etc/passwd';
      const result = service.sanitizeFilename(input);
      expect(result).not.toContain('..');
      expect(result).toBe('etc-passwd');
    });

    it('should remove path separators', () => {
      const input = 'path/to/file.txt';
      const result = service.sanitizeFilename(input);
      expect(result).not.toContain('/');
      // Path separators between words become dashes for readability
      expect(result).toBe('path-to-file.txt');
    });

    it('should replace dangerous characters', () => {
      const input = 'file<script>.pdf';
      const result = service.sanitizeFilename(input);
      expect(result).not.toContain('<');
      expect(result).toBe('file-script.pdf');
    });

    it('should replace spaces with dashes', () => {
      const input = 'my document.pdf';
      const result = service.sanitizeFilename(input);
      expect(result).toBe('my-document.pdf');
    });

    it('should limit length to 255 characters', () => {
      const input = 'a'.repeat(300) + '.txt';
      const result = service.sanitizeFilename(input);
      expect(result.length).toBeLessThanOrEqual(255);
    });

    it('should remove leading dots', () => {
      const input = '...hidden-file.txt';
      const result = service.sanitizeFilename(input);
      expect(result).not.toMatch(/^\./);
    });

    it('should return fallback for empty input', () => {
      expect(service.sanitizeFilename('')).toBe('untitled');
      expect(service.sanitizeFilename(null as any)).toBe('untitled');
    });

    it('should handle multiple dashes', () => {
      const input = 'file---name.pdf';
      const result = service.sanitizeFilename(input);
      expect(result).toBe('file-name.pdf');
    });

    it('should preserve file extensions', () => {
      const input = 'document.pdf';
      const result = service.sanitizeFilename(input);
      expect(result).toBe('document.pdf');
    });
  });

  describe('removeControlCharacters', () => {
    it('should remove null bytes', () => {
      const input = 'Hello\x00World';
      const result = service.removeControlCharacters(input);
      expect(result).toBe('HelloWorld');
    });

    it('should remove control characters', () => {
      const input = 'Test\x01\x02\x03String';
      const result = service.removeControlCharacters(input);
      expect(result).toBe('TestString');
    });

    it('should preserve tabs, newlines, carriage returns', () => {
      const input = 'Line1\nLine2\tTabbed\rReturn';
      const result = service.removeControlCharacters(input);
      expect(result).toContain('\n');
      expect(result).toContain('\t');
      expect(result).toContain('\r');
    });

    it('should handle empty string', () => {
      expect(service.removeControlCharacters('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(service.removeControlCharacters(null as any)).toBe('');
      expect(service.removeControlCharacters(undefined as any)).toBe('');
    });

    it('should remove DEL character (0x7F)', () => {
      const input = 'Test\x7FString';
      const result = service.removeControlCharacters(input);
      expect(result).toBe('TestString');
    });
  });

  describe('sanitizeEmail', () => {
    it('should convert to lowercase', () => {
      const input = 'USER@EXAMPLE.COM';
      const result = service.sanitizeEmail(input);
      expect(result).toBe('user@example.com');
    });

    it('should trim whitespace', () => {
      const input = '  user@example.com  ';
      const result = service.sanitizeEmail(input);
      expect(result).toBe('user@example.com');
    });

    it('should remove invalid characters', () => {
      const input = 'user<script>@example.com';
      const result = service.sanitizeEmail(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should limit length to 254 characters', () => {
      const input = 'a'.repeat(300) + '@example.com';
      const result = service.sanitizeEmail(input);
      expect(result.length).toBeLessThanOrEqual(254);
    });

    it('should handle empty string', () => {
      expect(service.sanitizeEmail('')).toBe('');
    });

    it('should preserve valid email characters', () => {
      const input = 'user.name+tag@example-domain.com';
      const result = service.sanitizeEmail(input);
      expect(result).toBe('user.name+tag@example-domain.com');
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow https URLs', () => {
      const input = 'https://example.com';
      const result = service.sanitizeUrl(input);
      expect(result).toBe('https://example.com');
    });

    it('should allow http URLs', () => {
      const input = 'http://example.com';
      const result = service.sanitizeUrl(input);
      expect(result).toBe('http://example.com');
    });

    it('should block javascript: protocol', () => {
      const input = 'javascript:alert(1)';
      const result = service.sanitizeUrl(input);
      expect(result).toBe('');
    });

    it('should block data: protocol', () => {
      const input = 'data:text/html,<script>alert(1)</script>';
      const result = service.sanitizeUrl(input);
      expect(result).toBe('');
    });

    it('should block vbscript: protocol', () => {
      const input = 'vbscript:msgbox(1)';
      const result = service.sanitizeUrl(input);
      expect(result).toBe('');
    });

    it('should block file: protocol', () => {
      const input = 'file:///etc/passwd';
      const result = service.sanitizeUrl(input);
      expect(result).toBe('');
    });

    it('should allow mailto: URLs', () => {
      const input = 'mailto:user@example.com';
      const result = service.sanitizeUrl(input);
      expect(result).toBe('mailto:user@example.com');
    });

    it('should handle custom allowed protocols', () => {
      const input = 'ftp://example.com';
      const result = service.sanitizeUrl(input, ['ftp']);
      expect(result).toBe('ftp://example.com');
    });

    it('should handle empty string', () => {
      expect(service.sanitizeUrl('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(service.sanitizeUrl(null as any)).toBe('');
      expect(service.sanitizeUrl(undefined as any)).toBe('');
    });

    it('should be case-insensitive for protocol checking', () => {
      const input = 'JAVASCRIPT:alert(1)';
      const result = service.sanitizeUrl(input);
      expect(result).toBe('');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize string values in object', () => {
      const input = {
        name: '<script>alert(1)</script>John',
        age: 25,
      };
      const result = service.sanitizeObject(input, 'strict');
      expect(result.name).not.toContain('<script>');
      expect(result.age).toBe(25);
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: '<b>John</b>',
          email: 'john@example.com',
        },
      };
      const result = service.sanitizeObject(input, 'moderate');
      expect(result.user.name).toContain('<b>John</b>');
    });

    it('should handle arrays', () => {
      const input = ['<script>test</script>', 'safe text'];
      const result = service.sanitizeObject(input, 'strict');
      expect(result[0]).not.toContain('<script>');
      expect(result[1]).toBe('safe text');
    });

    it('should preserve non-string values', () => {
      const input = {
        number: 42,
        boolean: true,
        date: new Date(),
        nullValue: null,
      };
      const result = service.sanitizeObject(input);
      expect(result.number).toBe(42);
      expect(result.boolean).toBe(true);
      expect(result.date).toEqual(input.date);
      expect(result.nullValue).toBeNull();
    });

    it('should handle null/undefined input', () => {
      expect(service.sanitizeObject(null)).toBeNull();
      expect(service.sanitizeObject(undefined)).toBeUndefined();
    });
  });

  describe('stripHtml', () => {
    it('should remove all HTML tags', () => {
      const input = '<p>Hello <b>World</b></p>';
      const result = service.stripHtml(input);
      expect(result).toBe('Hello World');
    });

    it('should handle complex HTML', () => {
      const input = '<div><h1>Title</h1><p>Content</p></div>';
      const result = service.stripHtml(input);
      expect(result).toBe('TitleContent');
    });

    it('should handle empty string', () => {
      expect(service.stripHtml('')).toBe('');
    });

    it('should handle plain text', () => {
      const input = 'Plain text';
      const result = service.stripHtml(input);
      expect(result).toBe('Plain text');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      const input = '<div>Test & "quotes"</div>';
      const result = service.escapeHtml(input);
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
    });

    it('should escape single quotes', () => {
      const input = "It's a test";
      const result = service.escapeHtml(input);
      expect(result).toContain('&#x27;');
    });

    it('should escape forward slashes', () => {
      const input = '</script>';
      const result = service.escapeHtml(input);
      expect(result).toContain('&#x2F;');
    });

    it('should handle empty string', () => {
      expect(service.escapeHtml('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(service.escapeHtml(null as any)).toBe('');
      expect(service.escapeHtml(undefined as any)).toBe('');
    });
  });

  describe('sanitizeJson', () => {
    it('should sanitize valid JSON', () => {
      const input = '{"name":"<script>alert(1)</script>John"}';
      const result = service.sanitizeJson(input);
      expect(result).not.toContain('<script>');
      expect(result).toContain('John');
    });

    it('should return null for invalid JSON', () => {
      const input = '{invalid json}';
      const result = service.sanitizeJson(input);
      expect(result).toBeNull();
    });

    it('should handle nested JSON', () => {
      const input = '{"user":{"name":"<b>Test</b>"}}';
      const result = service.sanitizeJson(input);
      expect(result).not.toContain('<b>');
    });

    it('should handle empty string', () => {
      expect(service.sanitizeJson('')).toBeNull();
    });

    it('should handle null/undefined', () => {
      expect(service.sanitizeJson(null as any)).toBeNull();
      expect(service.sanitizeJson(undefined as any)).toBeNull();
    });
  });

  describe('batchSanitize', () => {
    it('should sanitize array of strings', () => {
      const input = ['<script>test1</script>', '<b>test2</b>', 'test3'];
      const result = service.batchSanitize(input, 'strict');
      expect(result[0]).not.toContain('<script>');
      expect(result[1]).not.toContain('<b>');
      expect(result[2]).toBe('test3');
    });

    it('should handle empty array', () => {
      const result = service.batchSanitize([]);
      expect(result).toEqual([]);
    });

    it('should handle non-array input', () => {
      const result = service.batchSanitize(null as any);
      expect(result).toEqual([]);
    });

    it('should handle non-string values in array', () => {
      const input = ['<b>text</b>', 123 as any, null as any];
      const result = service.batchSanitize(input, 'moderate');
      expect(result[0]).toContain('<b>text</b>');
      expect(result[1]).toBe('');
      expect(result[2]).toBe('');
    });
  });
});
