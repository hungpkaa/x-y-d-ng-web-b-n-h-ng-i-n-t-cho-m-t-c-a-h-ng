// Check access without logging the URL or credentials. This does not change data.
const { Client } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Chưa cấu hình DATABASE_URL trong .env.');
    process.exitCode = 1;
    return;
  }
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
    application_name: 'electro-store-connection-check'
  });
  try {
    await client.connect();
    const { rows } = await client.query('SELECT current_database() AS database, current_user AS username');
    console.log(`Kết nối PostgreSQL thành công: database=${rows[0].database}, user=${rows[0].username}`);
  } catch (error) {
    const messages = {
      '28P01': 'Sai tài khoản hoặc mật khẩu PostgreSQL.',
      '28000': 'Tài khoản chưa được phép kết nối PostgreSQL.',
      '3D000': 'Database chưa tồn tại. Hãy tạo database electro_store.',
      ECONNREFUSED: 'Không kết nối được PostgreSQL. Kiểm tra dịch vụ và cổng.',
      ENOTFOUND: 'Không tìm thấy máy chủ PostgreSQL.'
    };
    console.error(messages[error.code] || 'Chưa kết nối được PostgreSQL. Kiểm tra DATABASE_URL và cấu hình máy chủ.');
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch(() => { console.error('Không thể kiểm tra PostgreSQL.'); process.exitCode = 1; });
