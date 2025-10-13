import { validate } from 'class-validator';
import {
  IsSafeFilename,
  IsSafeFilenameConstraint,
} from '../is-safe-filename.validator';

// Test DTO
class TestFilenameDto {
  @IsSafeFilename()
  filename!: string;
}

describe('IsSafeFilename Validator', () => {
  let validator: IsSafeFilenameConstraint;

  beforeEach(() => {
    validator = new IsSafeFilenameConstraint();
  });

  describe('Valid Filenames - Images', () => {
    it('should accept JPEG file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'profile-picture.jpg';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept PNG file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'image_123.png';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept GIF file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'animated-icon.gif';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept WEBP file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'modern-image.webp';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept SVG file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'logo.svg';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept JPEG alternative extension', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'photo.jpeg';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Valid Filenames - Documents', () => {
    it('should accept PDF file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'document_2024.pdf';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept Word document', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'report.docx';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept Excel file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'data-sheet.xlsx';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept PowerPoint', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'presentation.pptx';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept text file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'readme.txt';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept CSV file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'export_data.csv';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Valid Filenames - Archives', () => {
    it('should accept ZIP file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'archive_backup.zip';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept RAR file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'compressed.rar';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept 7z file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'data.7z';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept tar file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'backup.tar';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Valid Filenames - Code/Config', () => {
    it('should accept JSON file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'config_data.json';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept XML file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'settings.xml';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept YAML file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'docker-compose.yaml';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept YML file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'config.yml';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept Markdown file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'README.md';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Valid Filenames - Naming Conventions', () => {
    it('should accept filename with underscores', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'my_file_name.pdf';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept filename with dashes', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'my-file-name.pdf';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept filename with numbers', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'file123-report2024.pdf';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept uppercase filename', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'IMPORTANT_DOCUMENT.PDF';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept mixed case', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'MyFile_Report-2024.pdf';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Invalid Filenames - Dangerous Extensions', () => {
    it('should reject executable (.exe)', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'virus.exe';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isSafeFilename).toContain('safe');
    });

    it('should reject batch file (.bat)', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'script.bat';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject shell script (.sh)', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'install.sh';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject PHP file (.php)', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'webshell.php';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject JSP file (.jsp)', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'backdoor.jsp';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject ASP file (.asp)', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'shell.asp';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject ASPX file (.aspx)', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'backdoor.aspx';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject CMD file (.cmd)', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'malware.cmd';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Filenames - Directory Traversal', () => {
    it('should reject path with parent directory (..)', async () => {
      const dto = new TestFilenameDto();
      dto.filename = '../../../etc/passwd.txt';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject path with double dots', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'file..pdf';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject path traversal attempt', async () => {
      const dto = new TestFilenameDto();
      dto.filename = '..\\windows\\system32\\config.txt';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Filenames - Special Characters', () => {
    it('should reject filename with angle brackets', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'file<name>.pdf';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject filename with pipe character', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'file|name.pdf';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject filename with question mark', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'file?name.pdf';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject filename with asterisk', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'file*name.pdf';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject filename with colon', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'file:name.pdf';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject filename with quotes', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'file"name.pdf';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject filename with null byte', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'file\x00name.pdf';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject filename with control characters', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'file\x01name.pdf';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Filenames - Hidden Files', () => {
    it('should reject hidden file (starts with dot)', async () => {
      const dto = new TestFilenameDto();
      dto.filename = '.hidden-file.txt';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject .htaccess file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = '.htaccess';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject .env file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = '.env';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Filenames - Format Issues', () => {
    it('should reject filename without extension', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'filename-no-extension';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject filename too long (>255 chars)', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'a'.repeat(252) + '.pdf'; // 252 + 4 = 256 chars

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty filename', async () => {
      const dto = new TestFilenameDto();
      dto.filename = '';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject filename with only extension', async () => {
      const dto = new TestFilenameDto();
      dto.filename = '.pdf';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should reject null filename', async () => {
      const dto = new TestFilenameDto();
      dto.filename = null as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject undefined filename', async () => {
      const dto = new TestFilenameDto();
      dto.filename = undefined as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string filename', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 12345 as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject filename with whitespace only', async () => {
      const dto = new TestFilenameDto();
      dto.filename = '   .pdf';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept filename exactly 255 chars', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'a'.repeat(251) + '.pdf'; // 251 + 4 = 255

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Constraint Direct Validation', () => {
    it('should return false for dangerous extension', () => {
      const result = validator.validate('virus.exe', {
        constraints: [],
        object: {},
        property: 'filename',
        targetName: 'TestDto',
        value: 'virus.exe',
      });

      expect(result).toBe(false);
    });

    it('should return true for safe filename', () => {
      const result = validator.validate('document.pdf', {
        constraints: [],
        object: {},
        property: 'filename',
        targetName: 'TestDto',
        value: 'document.pdf',
      });

      expect(result).toBe(true);
    });

    it('should generate appropriate default message', () => {
      const message = validator.defaultMessage({
        constraints: [],
        object: {},
        property: 'filename',
        targetName: 'TestDto',
        value: 'invalid',
      });

      expect(message).toContain('safe');
      expect(message).toContain('255 chars');
      expect(message).toContain('allowed extensions');
    });
  });

  describe('Security - Path Traversal Attacks', () => {
    it('should block Unix path traversal', async () => {
      const dto = new TestFilenameDto();
      dto.filename = '../../../etc/passwd';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should block Windows path traversal', async () => {
      const dto = new TestFilenameDto();
      dto.filename = '..\\..\\..\\windows\\system32\\config';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should block URL encoded path traversal', async () => {
      const dto = new TestFilenameDto();
      dto.filename = '..%2F..%2F..%2Fetc%2Fpasswd';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Security - Double Extension Attacks', () => {
    it('should block .pdf.exe double extension', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'document.pdf.exe';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should block .jpg.php double extension', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'image.jpg.php';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should allow safe double extension .tar.gz', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'archive.tar.gz';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Security - SQL Injection Attempts', () => {
    it('should handle SQL injection in filename', async () => {
      const dto = new TestFilenameDto();
      dto.filename = "'; DROP TABLE files; --.pdf";

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle SQL quotes in filename', async () => {
      const dto = new TestFilenameDto();
      dto.filename = "file'OR'1'='1.pdf";

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Security - XSS Attempts', () => {
    it('should block script tags in filename', async () => {
      const dto = new TestFilenameDto();
      dto.filename = '<script>alert(1)</script>.pdf';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should block HTML entities in filename', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'file&lt;script&gt;.pdf';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should accept typical user uploaded profile picture', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'profile_photo_2024.jpg';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept typical document upload', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'Contract_Agreement_Final_v2.pdf';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept data export file', async () => {
      const dto = new TestFilenameDto();
      dto.filename = 'sales_report_2024-10-09.xlsx';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
