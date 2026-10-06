require('dotenv').config();

const express = require('express');
const path = require('path');
const multer = require('multer');

const db = require('./database');

const app = express();

const PORT =
  process.env.PORT || 3000;


// ======================================================
// MULTER - UPLOAD CSV
// ======================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 2 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const ext =
      path
        .extname(file.originalname)
        .toLowerCase();

    if (ext !== '.csv') {
      return cb(
        new Error(
          'File harus berformat CSV.'
        )
      );
    }

    cb(null, true);
  }
});


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(
  express.json({
    limit: '1mb'
  })
);


app.use(
  express.urlencoded({
    extended: true
  })
);


app.use(
  express.static(
    path.join(
      __dirname,
      'public'
    )
  )
);


// ======================================================
// HALAMAN
// ======================================================

app.get('/', (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      'public',
      'index.html'
    )
  );
});


app.get('/admin', (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      'public',
      'admin.html'
    )
  );
});


// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
  '/api/health',
  async (req, res) => {
    try {
      const result =
        await db.query(`
          SELECT
            NOW() AS waktu
        `);

      res.json({
        success: true,

        message:
          'Server dan database Supabase terhubung.',

        waktu:
          result.rows[0].waktu
      });

    } catch (error) {
      console.error(
        'Health check gagal:',
        error.message
      );

      res.status(500).json({
        success: false,

        error:
          'Database tidak dapat dihubungi.'
      });
    }
  }
);


// ======================================================
// BARANG - LIST
// ======================================================

app.get(
  '/api/barang',
  async (req, res) => {
    try {
      const search =
        String(
          req.query.search || ''
        ).trim();

      const result =
        await db.query(
          `
          SELECT
            id,
            kode,
            nama,
            satuan,
            stok

          FROM barang

          WHERE
            kode ILIKE $1
            OR nama ILIKE $1

          ORDER BY
            CASE
              WHEN kode ~ '[0-9]+'
                THEN CAST(
                  SUBSTRING(
                    kode FROM '[0-9]+'
                  )
                  AS INTEGER
                )
              ELSE 999999
            END ASC,
            kode ASC
          `,
          [
            `%${search}%`
          ]
        );

      res.json(
        result.rows
      );

    } catch (error) {
      console.error(
        'Gagal mengambil barang:',
        error.message
      );

      res.status(500).json({
        success: false,

        error:
          'Gagal mengambil data barang.'
      });
    }
  }
);


// ======================================================
// ADMIN - TAMBAH BARANG
// ======================================================

app.post(
  '/api/admin/barang/tambah',
  async (req, res) => {
    try {
      let {
        kode,
        nama,
        satuan,
        stok
      } = req.body;


      kode =
        String(kode || '')
          .trim()
          .toUpperCase();


      nama =
        String(nama || '')
          .trim();


      satuan =
        String(satuan || '')
          .trim();


      stok =
        Number.parseInt(
          stok,
          10
        );


      if (
        !kode ||
        !nama ||
        !satuan
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Kode, nama, dan satuan wajib diisi.'
          });
      }


      if (
        !Number.isInteger(stok) ||
        stok < 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Stok harus berupa angka 0 atau lebih.'
          });
      }


      const result =
        await db.query(
          `
          INSERT INTO barang (
            kode,
            nama,
            satuan,
            stok
          )

          VALUES (
            $1,
            $2,
            $3,
            $4
          )

          RETURNING
            id,
            kode,
            nama,
            satuan,
            stok
          `,
          [
            kode,
            nama,
            satuan,
            stok
          ]
        );


      res.status(201).json({
        success: true,

        message:
          'Barang berhasil ditambahkan.',

        data:
          result.rows[0]
      });

    } catch (error) {
      if (
        error.code === '23505'
      ) {
        return res
          .status(409)
          .json({
            success: false,

            error:
              'Kode barang sudah digunakan.'
          });
      }


      console.error(
        'Tambah barang gagal:',
        error.message
      );


      res.status(500).json({
        success: false,

        error:
          'Gagal menambahkan barang.'
      });
    }
  }
);


// ======================================================
// ADMIN - UPDATE STOK
// ======================================================

app.post(
  '/api/admin/barang/update-stok',
  async (req, res) => {
    try {
      const id =
        Number.parseInt(
          req.body.id,
          10
        );


      const stok =
        Number.parseInt(
          req.body.stok,
          10
        );


      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'ID barang tidak valid.'
          });
      }


      if (
        !Number.isInteger(stok) ||
        stok < 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Stok harus berupa angka 0 atau lebih.'
          });
      }


      const result =
        await db.query(
          `
          UPDATE barang

          SET
            stok = $1

          WHERE
            id = $2

          RETURNING
            id,
            kode,
            nama,
            satuan,
            stok
          `,
          [
            stok,
            id
          ]
        );


      if (
        result.rows.length === 0
      ) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              'Barang tidak ditemukan.'
          });
      }


      res.json({
        success: true,

        message:
          'Stok berhasil diperbarui.',

        data:
          result.rows[0]
      });

    } catch (error) {
      console.error(
        'Update stok gagal:',
        error.message
      );


      res.status(500).json({
        success: false,

        error:
          'Gagal memperbarui stok.'
      });
    }
  }
);


// ======================================================
// ADMIN - HAPUS BARANG
// ======================================================

app.delete(
  '/api/admin/barang/:id',
  async (req, res) => {
    try {
      const id =
        Number.parseInt(
          req.params.id,
          10
        );


      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'ID barang tidak valid.'
          });
      }


      const digunakan =
        await db.query(
          `
          SELECT
            id

          FROM detail_peminjaman

          WHERE
            barang_id = $1

          LIMIT 1
          `,
          [id]
        );


      if (
        digunakan.rows.length > 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Barang tidak dapat dihapus karena sudah tercatat dalam riwayat permintaan.'
          });
      }


      const result =
        await db.query(
          `
          DELETE FROM barang

          WHERE
            id = $1

          RETURNING id
          `,
          [id]
        );


      if (
        result.rows.length === 0
      ) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              'Barang tidak ditemukan.'
          });
      }


      res.json({
        success: true,

        message:
          'Barang berhasil dihapus.'
      });

    } catch (error) {
      console.error(
        'Hapus barang gagal:',
        error.message
      );


      res.status(500).json({
        success: false,

        error:
          'Gagal menghapus barang.'
      });
    }
  }
);


// ======================================================
// CSV - DETEKSI DELIMITER
// ======================================================

function detectDelimiter(text) {
  const firstLine =
    text
      .split(/\r?\n/)
      .find(
        line =>
          line.trim() !== ''
      ) || '';


  const comma =
    (
      firstLine.match(/,/g) ||
      []
    ).length;


  const semicolon =
    (
      firstLine.match(/;/g) ||
      []
    ).length;


  return semicolon > comma
    ? ';'
    : ',';
}


// ======================================================
// CSV - PARSER
// ======================================================

function parseCSV(text) {
  text =
    String(text || '')
      .replace(/^\uFEFF/, '');


  const delimiter =
    detectDelimiter(text);


  const rows = [];

  let row = [];
  let field = '';

  let insideQuotes = false;


  for (
    let i = 0;
    i < text.length;
    i++
  ) {
    const char =
      text[i];

    const next =
      text[i + 1];


    if (char === '"') {
      if (
        insideQuotes &&
        next === '"'
      ) {
        field += '"';
        i++;
      } else {
        insideQuotes =
          !insideQuotes;
      }

      continue;
    }


    if (
      char === delimiter &&
      !insideQuotes
    ) {
      row.push(field);

      field = '';

      continue;
    }


    if (
      (
        char === '\n' ||
        char === '\r'
      ) &&
      !insideQuotes
    ) {
      if (
        char === '\r' &&
        next === '\n'
      ) {
        i++;
      }


      row.push(field);


      const isEmpty =
        row.every(
          value =>
            String(value)
              .trim() === ''
        );


      if (!isEmpty) {
        rows.push(row);
      }


      row = [];
      field = '';

      continue;
    }


    field += char;
  }


  if (
    field.length > 0 ||
    row.length > 0
  ) {
    row.push(field);


    const isEmpty =
      row.every(
        value =>
          String(value)
            .trim() === ''
      );


    if (!isEmpty) {
      rows.push(row);
    }
  }


  return rows;
}


// ======================================================
// CSV - NORMALISASI HEADER
// ======================================================

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(
      /[^a-z0-9_]/g,
      ''
    );
}


// ======================================================
// ADMIN - IMPORT CSV
// ======================================================

app.post(
  '/api/admin/barang/import',

  upload.single('file'),

  async (req, res) => {
    let client;

    try {
      if (!req.file) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'File CSV belum dipilih.'
          });
      }


      const csvText =
        req.file.buffer
          .toString('utf8');


      const rows =
        parseCSV(csvText);


      if (
        rows.length < 2
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'CSV kosong atau tidak memiliki data.'
          });
      }


      const headers =
        rows[0]
          .map(
            normalizeHeader
          );


      const kodeIndex =
        headers.indexOf('kode');

      const namaIndex =
        headers.indexOf('nama');

      const satuanIndex =
        headers.indexOf('satuan');

      const stokIndex =
        headers.indexOf('stok');


      if (
        kodeIndex === -1 ||
        namaIndex === -1 ||
        satuanIndex === -1 ||
        stokIndex === -1
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Format CSV tidak sesuai. Header wajib: kode,nama,satuan,stok'
          });
      }


      const validRows = [];
      const errors = [];


      for (
        let i = 1;
        i < rows.length;
        i++
      ) {
        const row =
          rows[i];


        const nomorBaris =
          i + 1;


        const kode =
          String(
            row[kodeIndex] || ''
          )
            .trim()
            .toUpperCase();


        const nama =
          String(
            row[namaIndex] || ''
          )
            .trim();


        const satuan =
          String(
            row[satuanIndex] || ''
          )
            .trim();


        const stokText =
          String(
            row[stokIndex] || ''
          )
            .trim();


        const stok =
          Number(stokText);


        if (
          !kode &&
          !nama &&
          !satuan &&
          !stokText
        ) {
          continue;
        }


        if (!kode) {
          errors.push({
            baris:
              nomorBaris,

            error:
              'Kode barang kosong.'
          });

          continue;
        }


        if (!nama) {
          errors.push({
            baris:
              nomorBaris,

            kode,

            error:
              'Nama barang kosong.'
          });

          continue;
        }


        if (!satuan) {
          errors.push({
            baris:
              nomorBaris,

            kode,

            error:
              'Satuan kosong.'
          });

          continue;
        }


        if (
          stokText === '' ||
          !Number.isInteger(stok) ||
          stok < 0
        ) {
          errors.push({
            baris:
              nomorBaris,

            kode,

            error:
              'Stok harus berupa angka bulat 0 atau lebih.'
          });

          continue;
        }


        validRows.push({
          kode,
          nama,
          satuan,
          stok
        });
      }


      if (
        validRows.length === 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Tidak ada data valid yang dapat diimpor.',

            errors
          });
      }


      const seen =
        new Set();


      const duplicateCodes =
        new Set();


      for (
        const item of validRows
      ) {
        if (
          seen.has(item.kode)
        ) {
          duplicateCodes.add(
            item.kode
          );
        }

        seen.add(
          item.kode
        );
      }


      if (
        duplicateCodes.size > 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Terdapat kode barang ganda di dalam file CSV.',

            duplicates:
              Array.from(
                duplicateCodes
              )
          });
      }


      client =
        await db.pool.connect();


      await client.query(
        'BEGIN'
      );


      let inserted = 0;
      let updated = 0;


      for (
        const item of validRows
      ) {
        const existing =
          await client.query(
            `
            SELECT
              id

            FROM barang

            WHERE
              LOWER(kode)
              =
              LOWER($1)

            LIMIT 1
            `,
            [
              item.kode
            ]
          );


        if (
          existing.rows.length > 0
        ) {
          await client.query(
            `
            UPDATE barang

            SET
              nama = $1,
              satuan = $2,
              stok = $3

            WHERE
              id = $4
            `,
            [
              item.nama,
              item.satuan,
              item.stok,
              existing.rows[0].id
            ]
          );


          updated++;

        } else {
          await client.query(
            `
            INSERT INTO barang (
              kode,
              nama,
              satuan,
              stok
            )

            VALUES (
              $1,
              $2,
              $3,
              $4
            )
            `,
            [
              item.kode,
              item.nama,
              item.satuan,
              item.stok
            ]
          );


          inserted++;
        }
      }


      await client.query(
        'COMMIT'
      );


      res.json({
        success: true,

        message:
          'Import data barang berhasil.',

        summary: {
          total_baris:
            rows.length - 1,

          valid:
            validRows.length,

          ditambahkan:
            inserted,

          diperbarui:
            updated,

          gagal:
            errors.length
        },

        errors
      });

    } catch (error) {
      if (client) {
        try {
          await client.query(
            'ROLLBACK'
          );
        } catch (_) {}
      }


      console.error(
        'Import CSV gagal:',
        error
      );


      res.status(500).json({
        success: false,

        error:
          error.message ||
          'Gagal mengimpor file CSV.'
      });

    } finally {
      if (client) {
        client.release();
      }
    }
  }
);


// ======================================================
// PERMINTAAN ATK
// ======================================================

app.post(
  '/api/peminjaman',
  async (req, res) => {
    let client;

    try {
      let {
        nama,
        bidang,
        keperluan,
        items
      } = req.body;


      // ------------------------------------------
      // NORMALISASI
      // ------------------------------------------

      nama =
        String(nama || '')
          .trim();


      bidang =
        String(bidang || '')
          .trim();


      keperluan =
        String(keperluan || '')
          .trim();


      // ------------------------------------------
      // VALIDASI WAJIB
      // ------------------------------------------

      if (
        !nama ||
        !bidang
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Nama dan bidang wajib diisi.'
          });
      }


      // ------------------------------------------
      // VALIDASI BIDANG
      // ------------------------------------------

      const bidangValid = [
        'Tata Usaha',
        'Pemeriksaan',
        'Penindakan',
        'Infokom'
      ];


      if (
        !bidangValid.includes(
          bidang
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Bidang / unit kerja tidak valid.'
          });
      }


      // ------------------------------------------
      // VALIDASI BARANG
      // ------------------------------------------

      if (
        !Array.isArray(items) ||
        items.length === 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Pilih minimal satu barang.'
          });
      }


      const itemMap =
        new Map();


      for (
        const item of items
      ) {
        const barangId =
          Number.parseInt(
            item.barang_id,
            10
          );


        const jumlah =
          Number.parseInt(
            item.jumlah,
            10
          );


        if (
          !Number.isInteger(
            barangId
          ) ||
          barangId <= 0 ||
          !Number.isInteger(
            jumlah
          ) ||
          jumlah <= 0
        ) {
          return res
            .status(400)
            .json({
              success: false,

              error:
                'Data barang tidak valid.'
            });
        }


        itemMap.set(
          barangId,

          (
            itemMap.get(
              barangId
            ) || 0
          ) + jumlah
        );
      }


      const normalizedItems =
        Array.from(
          itemMap.entries()
        )
          .map(
            (
              [
                barang_id,
                jumlah
              ]
            ) => ({
              barang_id,
              jumlah
            })
          );


      // ------------------------------------------
      // DATABASE TRANSACTION
      // ------------------------------------------

      client =
        await db.pool.connect();


      await client.query(
        'BEGIN'
      );


      // ------------------------------------------
      // CEK STOK
      // ------------------------------------------

      for (
        const item of normalizedItems
      ) {
        const barangResult =
          await client.query(
            `
            SELECT
              id,
              nama,
              stok

            FROM barang

            WHERE
              id = $1

            FOR UPDATE
            `,
            [
              item.barang_id
            ]
          );


        if (
          barangResult.rows.length ===
          0
        ) {
          await client.query(
            'ROLLBACK'
          );


          return res
            .status(404)
            .json({
              success: false,

              error:
                'Barang tidak ditemukan.'
            });
        }


        const barang =
          barangResult.rows[0];


        if (
          Number(barang.stok) <
          item.jumlah
        ) {
          await client.query(
            'ROLLBACK'
          );


          return res
            .status(400)
            .json({
              success: false,

              error:
                `Stok ${barang.nama} tidak mencukupi. Stok tersedia: ${barang.stok}.`
            });
        }
      }


      // ------------------------------------------
      // NOMOR PERMINTAAN
      // ------------------------------------------

      const now =
        new Date();


      const tahun =
        now.getFullYear();


      const random =
        Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase();


      const nomorPinjam =
        `ATK-${tahun}-${random}`;


      // ------------------------------------------
      // SIMPAN HEADER
      // ------------------------------------------

      const peminjaman =
        await client.query(
          `
          INSERT INTO peminjaman (
            nomor_pinjam,
            nama_peminjam,
            email,
            bidang,
            keperluan,
            status
          )

          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            'Pending'
          )

          RETURNING
            id
          `,
          [
            nomorPinjam,
            nama,

            // email tidak dipakai lagi,
            // tetapi kolom DB tetap diisi string kosong
            // agar kompatibel bila kolom email NOT NULL.
            '',

            bidang,

            // keperluan opsional
            keperluan || ''
          ]
        );


      const peminjamanId =
        peminjaman.rows[0].id;


      // ------------------------------------------
      // SIMPAN DETAIL
      // ------------------------------------------

      for (
        const item of normalizedItems
      ) {
        await client.query(
          `
          INSERT INTO detail_peminjaman (
            peminjaman_id,
            barang_id,
            jumlah
          )

          VALUES (
            $1,
            $2,
            $3
          )
          `,
          [
            peminjamanId,
            item.barang_id,
            item.jumlah
          ]
        );
      }


      await client.query(
        'COMMIT'
      );


      res.status(201).json({
        success: true,

        message:
          'Permintaan berhasil dikirim.',

        nomor_pinjam:
          nomorPinjam
      });

    } catch (error) {
      if (client) {
        try {
          await client.query(
            'ROLLBACK'
          );
        } catch (_) {}
      }


      console.error(
        'Permintaan gagal:',
        error
      );


      res.status(500).json({
        success: false,

        error:
          'Terjadi kesalahan saat menyimpan permintaan.'
      });

    } finally {
      if (client) {
        client.release();
      }
    }
  }
);


// ======================================================
// ADMIN - DAFTAR PERMINTAAN
// ======================================================

app.get(
  '/api/admin/peminjaman',
  async (req, res) => {
    try {
      const result =
        await db.query(
          `
          SELECT
            p.id,
            p.nomor_pinjam,
            p.nama_peminjam,
            p.email,
            p.bidang,
            p.keperluan,
            p.status,
            p.tanggal,

            COALESCE(
              STRING_AGG(
                b.nama ||
                ' (' ||
                dp.jumlah ||
                ' ' ||
                b.satuan ||
                ')',
                ', '
                ORDER BY b.nama
              ),
              '-'
            ) AS item_list

          FROM peminjaman p

          LEFT JOIN detail_peminjaman dp
            ON
              dp.peminjaman_id =
              p.id

          LEFT JOIN barang b
            ON
              b.id =
              dp.barang_id

          GROUP BY
            p.id,
            p.nomor_pinjam,
            p.nama_peminjam,
            p.email,
            p.bidang,
            p.keperluan,
            p.status,
            p.tanggal

          ORDER BY
            CASE
              WHEN p.status = 'Pending'
                THEN 1

              WHEN p.status = 'Disetujui'
                THEN 2

              ELSE 3
            END,

            p.tanggal DESC
          `
        );


      res.json(
        result.rows
      );

    } catch (error) {
      console.error(
        'Daftar permintaan gagal:',
        error.message
      );


      res.status(500).json({
        success: false,

        error:
          'Gagal mengambil daftar permintaan.'
      });
    }
  }
);


// ======================================================
// ADMIN - DETAIL PERMINTAAN
// ======================================================

app.get(
  '/api/admin/peminjaman/:id',
  async (req, res) => {
    try {
      const id =
        Number.parseInt(
          req.params.id,
          10
        );


      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'ID tidak valid.'
          });
      }


      const peminjaman =
        await db.query(
          `
          SELECT
            id,
            nomor_pinjam,
            nama_peminjam,
            email,
            bidang,
            keperluan,
            status,
            tanggal

          FROM peminjaman

          WHERE
            id = $1
          `,
          [id]
        );


      if (
        peminjaman.rows.length ===
        0
      ) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              'Permintaan tidak ditemukan.'
          });
      }


      const items =
        await db.query(
          `
          SELECT
  dp.id,
  dp.barang_id,
  dp.jumlah,
  dp.jumlah_disetujui,

  b.kode,
            b.nama,
            b.satuan,
            b.stok

          FROM detail_peminjaman dp

          JOIN barang b
            ON
              b.id =
              dp.barang_id

          WHERE
            dp.peminjaman_id = $1

          ORDER BY
            CASE
              WHEN b.kode ~ '[0-9]+'
                THEN CAST(
                  SUBSTRING(
                    b.kode FROM '[0-9]+'
                  )
                  AS INTEGER
                )
              ELSE 999999
            END ASC,
            b.kode ASC
          `,
          [id]
        );


      res.json({
        success: true,

        peminjaman:
          peminjaman.rows[0],

        items:
          items.rows
      });

    } catch (error) {
      console.error(
        'Detail permintaan gagal:',
        error.message
      );


      res.status(500).json({
        success: false,

        error:
          'Gagal mengambil detail permintaan.'
      });
    }
  }
);


// ======================================================
// ADMIN - UPDATE STATUS PERMINTAAN
// ======================================================

app.post(
  '/api/admin/peminjaman/status',
  async (req, res) => {
    let client;

    try {
      const id =
        Number.parseInt(
          req.body.id,
          10
        );

      const status =
        String(
          req.body.status || ''
        ).trim();

      const approvalItems =
        Array.isArray(req.body.items)
          ? req.body.items
          : null;

      const allowed = [
        'Pending',
        'Disetujui',
        'Ditolak'
      ];


      if (
        !Number.isInteger(id) ||
        id <= 0 ||
        !allowed.includes(status)
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              'Data status tidak valid.'
          });
      }


      client =
        await db.pool.connect();

      await client.query('BEGIN');


      // ==============================================
      // LOCK PERMINTAAN
      // ==============================================

      const current =
        await client.query(
          `
          SELECT
            id,
            status

          FROM peminjaman

          WHERE id = $1

          FOR UPDATE
          `,
          [id]
        );


      if (
        current.rows.length === 0
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res
          .status(404)
          .json({
            success: false,
            error:
              'Permintaan tidak ditemukan.'
          });
      }


      const oldStatus =
        current.rows[0].status;


      // ==============================================
      // AMBIL DETAIL + LOCK BARANG
      // ==============================================

      const detailResult =
        await client.query(
          `
          SELECT
            dp.id AS detail_id,
            dp.barang_id,
            dp.jumlah,
            dp.jumlah_disetujui,

            b.nama,
            b.stok

          FROM detail_peminjaman dp

          JOIN barang b
            ON b.id = dp.barang_id

          WHERE
            dp.peminjaman_id = $1

          ORDER BY dp.id

          FOR UPDATE OF dp, b
          `,
          [id]
        );


      const details =
        detailResult.rows;


      // ==============================================
      // STATUS DISETUJUI
      // ==============================================

      if (
        status === 'Disetujui'
      ) {
        const approvalMap =
          new Map();


        // Jika frontend mengirim jumlah persetujuan,
        // gunakan nilai tersebut.
        if (approvalItems) {
          for (
            const item of approvalItems
          ) {
            const detailId =
              Number.parseInt(
                item.detail_id,
                10
              );

            const jumlahDisetujui =
              Number.parseInt(
                item.jumlah_disetujui,
                10
              );


            if (
              !Number.isInteger(
                detailId
              ) ||
              !Number.isInteger(
                jumlahDisetujui
              ) ||
              jumlahDisetujui < 0
            ) {
              await client.query(
                'ROLLBACK'
              );

              return res
                .status(400)
                .json({
                  success: false,
                  error:
                    'Jumlah persetujuan tidak valid.'
                });
            }


            approvalMap.set(
              detailId,
              jumlahDisetujui
            );
          }
        }


        let totalDisetujui = 0;


        for (
          const detail of details
        ) {
          const jumlahPermintaan =
            Number(
              detail.jumlah
            );

          const jumlahLama =
            oldStatus === 'Disetujui'
              ? Number(
                  detail.jumlah_disetujui
                )
              : 0;


          // Jika frontend belum mengirim items,
          // setujui penuh agar kompatibel
          // dengan tombol admin lama.
          const jumlahBaru =
            approvalItems
              ? (
                  approvalMap.has(
                    Number(
                      detail.detail_id
                    )
                  )
                    ? Number(
                        approvalMap.get(
                          Number(
                            detail.detail_id
                          )
                        )
                      )
                    : 0
                )
              : jumlahPermintaan;


          if (
            jumlahBaru >
            jumlahPermintaan
          ) {
            await client.query(
              'ROLLBACK'
            );

            return res
              .status(400)
              .json({
                success: false,

                error:
                  `Jumlah disetujui untuk ${detail.nama} tidak boleh melebihi jumlah permintaan (${jumlahPermintaan}).`
              });
          }


          const selisih =
            jumlahBaru -
            jumlahLama;


          // Jika persetujuan bertambah,
          // stok harus cukup.
          if (
            selisih > 0 &&
            Number(detail.stok) <
            selisih
          ) {
            await client.query(
              'ROLLBACK'
            );

            return res
              .status(400)
              .json({
                success: false,

                error:
                  `Stok ${detail.nama} tidak mencukupi. Stok tersedia: ${detail.stok}.`
              });
          }


          // Persetujuan bertambah:
          // kurangi stok.
          if (
            selisih > 0
          ) {
            await client.query(
              `
              UPDATE barang

              SET
                stok =
                  stok - $1

              WHERE
                id = $2
              `,
              [
                selisih,
                detail.barang_id
              ]
            );
          }


          // Persetujuan berkurang:
          // kembalikan stok.
          if (
            selisih < 0
          ) {
            await client.query(
              `
              UPDATE barang

              SET
                stok =
                  stok + $1

              WHERE
                id = $2
              `,
              [
                Math.abs(selisih),
                detail.barang_id
              ]
            );
          }


          await client.query(
            `
            UPDATE detail_peminjaman

            SET
              jumlah_disetujui = $1

            WHERE
              id = $2
            `,
            [
              jumlahBaru,
              detail.detail_id
            ]
          );


          totalDisetujui +=
            jumlahBaru;
        }


        // Tidak boleh status Disetujui
        // jika semua item bernilai 0.
        if (
          totalDisetujui === 0
        ) {
          await client.query(
            'ROLLBACK'
          );

          return res
            .status(400)
            .json({
              success: false,

              error:
                'Minimal satu barang harus memiliki jumlah disetujui lebih dari 0.'
            });
        }
      }


      // ==============================================
      // DISETUJUI -> PENDING / DITOLAK
      // ==============================================

      if (
        oldStatus === 'Disetujui' &&
        status !== 'Disetujui'
      ) {
        for (
          const detail of details
        ) {
          const jumlahLama =
            Number(
              detail.jumlah_disetujui
            );


          if (
            jumlahLama > 0
          ) {
            await client.query(
              `
              UPDATE barang

              SET
                stok =
                  stok + $1

              WHERE
                id = $2
              `,
              [
                jumlahLama,
                detail.barang_id
              ]
            );
          }


          await client.query(
            `
            UPDATE detail_peminjaman

            SET
              jumlah_disetujui = 0

            WHERE
              id = $1
            `,
            [
              detail.detail_id
            ]
          );
        }
      }


      // ==============================================
      // PENDING / DITOLAK
      // ==============================================

      if (
        oldStatus !== 'Disetujui' &&
        status !== 'Disetujui'
      ) {
        await client.query(
          `
          UPDATE detail_peminjaman

          SET
            jumlah_disetujui = 0

          WHERE
            peminjaman_id = $1
          `,
          [id]
        );
      }


      // ==============================================
      // UPDATE STATUS
      // ==============================================

      await client.query(
        `
        UPDATE peminjaman

        SET
          status = $1

        WHERE
          id = $2
        `,
        [
          status,
          id
        ]
      );


      await client.query(
        'COMMIT'
      );


      res.json({
        success: true,

        message:
          status === 'Disetujui'
            ? 'Persetujuan barang berhasil disimpan dan stok telah diperbarui.'
            : `Status berhasil diubah menjadi ${status}.`
      });

    } catch (error) {
      if (client) {
        try {
          await client.query(
            'ROLLBACK'
          );
        } catch (_) {}
      }


      console.error(
        'Update status gagal:',
        error
      );


      res.status(500).json({
        success: false,

        error:
          'Gagal mengubah status permintaan.'
      });

    } finally {
      if (client) {
        client.release();
      }
    }
  }
);


// ======================================================
// ADMIN - STATISTIK
// ======================================================

app.get(
  '/api/admin/statistik',
  async (req, res) => {
    try {
      const result =
        await db.query(
          `
          SELECT

            (
              SELECT
                COUNT(*)

              FROM barang
            )::INTEGER
            AS total_barang,


            (
              SELECT
                COALESCE(
                  SUM(stok),
                  0
                )

              FROM barang
            )::INTEGER
            AS total_stok,


            (
              SELECT
                COUNT(*)

              FROM peminjaman

              WHERE
                status = 'Pending'
            )::INTEGER
            AS pending,


            (
              SELECT
                COUNT(*)

              FROM peminjaman

              WHERE
                status = 'Disetujui'
            )::INTEGER
            AS disetujui,


            (
              SELECT
                COUNT(*)

              FROM peminjaman

              WHERE
                status = 'Ditolak'
            )::INTEGER
            AS ditolak
          `
        );


      res.json({
        success: true,

        data:
          result.rows[0]
      });

    } catch (error) {
      console.error(
        'Statistik gagal:',
        error.message
      );


      res.status(500).json({
        success: false,

        error:
          'Gagal mengambil statistik.'
      });
    }
  }
);

// ======================================================
// ADMIN - LAPORAN / SURAT ATK
// ======================================================

app.get(
  '/api/admin/laporan',
  async (req, res) => {
    try {
      const bidang =
        String(
          req.query.bidang || ''
        ).trim();

      const tanggalMulai =
        String(
          req.query.tanggal_mulai || ''
        ).trim();

      const tanggalSelesai =
        String(
          req.query.tanggal_selesai || ''
        ).trim();

      const jenis =
        String(
          req.query.jenis || 'permintaan'
        ).trim();


      // ------------------------------------------
      // VALIDASI JENIS SURAT
      // ------------------------------------------

      const jenisValid = [
        'permintaan',
        'sbbk'
      ];


      if (
        !jenisValid.includes(jenis)
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              'Jenis laporan tidak valid.'
          });
      }


      // ------------------------------------------
      // VALIDASI BIDANG
      // ------------------------------------------

      const bidangValid = [
        '',
        'Tata Usaha',
        'Pemeriksaan',
        'Penindakan',
        'Infokom'
      ];


      if (
        !bidangValid.includes(bidang)
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              'Bidang tidak valid.'
          });
      }


      // ------------------------------------------
      // VALIDASI TANGGAL
      // ------------------------------------------

      if (
        !tanggalMulai ||
        !tanggalSelesai
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              'Tanggal mulai dan tanggal selesai wajib diisi.'
          });
      }


      // ------------------------------------------
      // PARAMETER QUERY
      // ------------------------------------------

      const params = [
        tanggalMulai,
        tanggalSelesai
      ];


      let bidangCondition = '';

      if (bidang) {
        params.push(bidang);

        bidangCondition = `
          AND p.bidang = $${params.length}
        `;
      }


      // SBBK hanya mengambil permintaan
      // yang sudah disetujui.
      let statusCondition = '';

      if (
        jenis === 'sbbk'
      ) {
        statusCondition = `
          AND p.status = 'Disetujui'
        `;
      }


      // SBBK hanya mengambil barang yang
      // jumlah_disetujui > 0.
      let itemCondition = '';

      if (
        jenis === 'sbbk'
      ) {
        itemCondition = `
          AND dp.jumlah_disetujui > 0
        `;
      }


      // ------------------------------------------
      // AMBIL DATA
      // ------------------------------------------

      const result =
        await db.query(
          `
          SELECT
            p.id AS peminjaman_id,
            p.nomor_pinjam,
            p.nama_peminjam,
            p.bidang,
            p.keperluan,
            p.status,
            p.tanggal,

            dp.id AS detail_id,
            dp.barang_id,
            dp.jumlah,
            dp.jumlah_disetujui,

            b.kode,
            b.nama AS nama_barang,
            b.satuan

          FROM peminjaman p

          JOIN detail_peminjaman dp
            ON dp.peminjaman_id = p.id

          JOIN barang b
            ON b.id = dp.barang_id

          WHERE
            p.tanggal >= $1::date

            AND p.tanggal <
              (
                $2::date +
                INTERVAL '1 day'
              )

            ${bidangCondition}

            ${statusCondition}

            ${itemCondition}

          ORDER BY
            p.tanggal ASC,

            p.id ASC,

            CASE
              WHEN b.kode ~ '[0-9]+'
                THEN CAST(
                  SUBSTRING(
                    b.kode FROM '[0-9]+'
                  )
                  AS INTEGER
                )
              ELSE 999999
            END ASC,

            b.kode ASC
          `,
          params
        );


      // ------------------------------------------
      // KELOMPOKKAN BERDASARKAN PERMINTAAN
      // ------------------------------------------

      const laporanMap =
        new Map();


      for (
        const row of result.rows
      ) {
        const id =
          Number(
            row.peminjaman_id
          );


        if (
          !laporanMap.has(id)
        ) {
          laporanMap.set(
            id,
            {
              id,

              nomor_pinjam:
                row.nomor_pinjam,

              nama_peminjam:
                row.nama_peminjam,

              bidang:
                row.bidang,

              keperluan:
                row.keperluan || '',

              status:
                row.status,

              tanggal:
                row.tanggal,

              items: []
            }
          );
        }


        laporanMap
          .get(id)
          .items
          .push({
            detail_id:
              row.detail_id,

            barang_id:
              row.barang_id,

            kode:
              row.kode,

            nama:
              row.nama_barang,

            satuan:
              row.satuan,

            jumlah:
              Number(
                row.jumlah
              ) || 0,

            jumlah_disetujui:
              Number(
                row.jumlah_disetujui
              ) || 0
          });
      }


      const data =
        Array.from(
          laporanMap.values()
        );


      // ------------------------------------------
      // RESPONSE
      // ------------------------------------------

      res.json({
        success: true,

        filter: {
          jenis,
          bidang:
            bidang || 'Semua Bidang',

          tanggal_mulai:
            tanggalMulai,

          tanggal_selesai:
            tanggalSelesai
        },

        total_permintaan:
          data.length,

        total_item:
          result.rows.length,

        data
      });

    } catch (error) {
      console.error(
        'Laporan ATK gagal:',
        error
      );


      res.status(500).json({
        success: false,

        error:
          'Gagal mengambil data laporan ATK.'
      });
    }
  }
);
// ======================================================
// API 404
// ======================================================

app.use(
  '/api',
  (req, res) => {
    res.status(404).json({
      success: false,

      error:
        'Endpoint API tidak ditemukan.'
    });
  }
);


// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      'Server error:',
      error.message
    );


    if (
      error instanceof
      multer.MulterError
    ) {
      if (
        error.code ===
        'LIMIT_FILE_SIZE'
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              'Ukuran file CSV maksimal 2 MB.'
          });
      }
    }


    res.status(500).json({
      success: false,

      error:
        error.message ||
        'Terjadi kesalahan pada server.'
    });
  }
);


// ======================================================
// LOCAL SERVER
// ======================================================

if (
  require.main === module
) {
  app.listen(
    PORT,
    '0.0.0.0',
    async () => {
      console.log(
        `✅ Server berjalan di http://localhost:${PORT}`
      );

      console.log(
        `📄 Form ATK: http://localhost:${PORT}`
      );

      console.log(
        `🔧 Admin: http://localhost:${PORT}/admin`
      );


      await db.testConnection();
    }
  );
}


// ======================================================
// VERCEL
// ======================================================

module.exports = app;