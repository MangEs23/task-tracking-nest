import { parseMentionEmails } from './parse-mention-emails';

describe('parseMentionEmails', () => {
  it.each([undefined, null, '', '   '])(
    'input kosong menghasilkan array kosong: %j',
    (description) => {
      expect(parseMentionEmails(description)).toEqual([]);
    },
  );

  it('teks tanpa mention menghasilkan array kosong', () => {
    expect(
      parseMentionEmails('Tolong periksa task ini.'),
    ).toEqual([]);
  });

  it('mengekstrak satu mention', () => {
    expect(
      parseMentionEmails('Tolong cek @angga@example.com'),
    ).toEqual(['angga@example.com']);
  });

  it('mengekstrak beberapa mention sesuai urutan kemunculan', () => {
    expect(
      parseMentionEmails(
        '@angga@example.com diskusikan dengan @salman@example.com',
      ),
    ).toEqual([
      'angga@example.com',
      'salman@example.com',
    ]);
  });

  it('mengubah email menjadi lowercase', () => {
    expect(
      parseMentionEmails('Tolong cek @ANGGA@Example.COM'),
    ).toEqual(['angga@example.com']);
  });

  it('menghapus duplikasi setelah normalisasi', () => {
    expect(
      parseMentionEmails(
        '@angga@example.com @ANGGA@EXAMPLE.COM @salman@example.com',
      ),
    ).toEqual([
      'angga@example.com',
      'salman@example.com',
    ]);
  });

  it('titik akhir kalimat tidak ikut menjadi email', () => {
    expect(
      parseMentionEmails('Tolong cek @a@b.com.'),
    ).toEqual(['a@b.com']);
  });

  it('mendukung mention diikuti tanda baca', () => {
    expect(
      parseMentionEmails(
        '(@angga@example.com), @salman@example.com!',
      ),
    ).toEqual([
      'angga@example.com',
      'salman@example.com',
    ]);
  });

  it('mendukung mention pada beberapa baris', () => {
    expect(
      parseMentionEmails(
        'Reviewer: @angga@example.com\nPenulis: @salman@example.com',
      ),
    ).toEqual([
      'angga@example.com',
      'salman@example.com',
    ]);
  });

  it('email biasa tanpa awalan mention diabaikan', () => {
    expect(
      parseMentionEmails(
        'Hubungi vendor@example.com atau support@example.org.',
      ),
    ).toEqual([]);
  });

  it('membedakan email biasa dengan token mention', () => {
    expect(
      parseMentionEmails(
        'Hubungi vendor@example.com, lalu kabari @angga@example.com.',
      ),
    ).toEqual(['angga@example.com']);
  });

  it('nama tanpa email tidak dianggap mention', () => {
    expect(
      parseMentionEmails('Tolong cek @Angga dan @Salman'),
    ).toEqual([]);
  });

  it('mendukung karakter email yang tercantum dalam regex spesifikasi', () => {
    expect(
      parseMentionEmails(
        '@nama.depan+review@example.co.id @nama_user@example-domain.com',
      ),
    ).toEqual([
      'nama.depan+review@example.co.id',
      'nama_user@example-domain.com',
    ]);
  });

  it('email dengan domain tanpa titik tidak cocok', () => {
    expect(
      parseMentionEmails('Tolong cek @user@localhost'),
    ).toEqual([]);
  });

  it('pemanggilan berulang memberikan hasil yang konsisten', () => {
    const description = 'Tolong cek @angga@example.com';

    expect(parseMentionEmails(description)).toEqual([
      'angga@example.com',
    ]);

    expect(parseMentionEmails(description)).toEqual([
      'angga@example.com',
    ]);
  });
});