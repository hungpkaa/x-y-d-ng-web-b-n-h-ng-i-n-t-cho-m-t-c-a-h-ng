const tables = { categories:'categories', brands:'brands' };
function slugify(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
function saveCatalog(db, actor, kind, input) {
  const table = tables[kind];
  if (actor.role !== 'ADMIN') return { status:403, message:'Chỉ quản trị viên được quản lý danh mục và thương hiệu.' };
  if (!table) return { status:404, message:'Không tìm thấy chức năng.' };
  const id = input.id ? Number(input.id) : null;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const slug = typeof input.slug === 'string' ? input.slug.trim() : '';
  const active = input.active === '1' ? 1 : input.active === '0' ? 0 : null;
  if ((id !== null && (!Number.isSafeInteger(id) || id <= 0)) || !name || name.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 150 || active === null) return { status:400, message:'Kiểm tra tên, đường dẫn (chữ thường không dấu và dấu gạch ngang) và trạng thái.' };
  if (id !== null && !db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(id)) return { status:404, message:'Không tìm thấy dữ liệu.' };
  try {
    if (id !== null) db.prepare(`UPDATE ${table} SET name=?,slug=?,active=? WHERE id=?`).run(name,slug,active,id);
    else db.prepare(`INSERT INTO ${table}(name,slug,active) VALUES(?,?,?)`).run(name,slug,active);
    return { status:200, message:'Đã lưu. Ngừng sử dụng chỉ ngăn gán cho sản phẩm mới, không ẩn sản phẩm hiện có.' };
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed')) return { status:409, message:'Tên hoặc đường dẫn đã tồn tại.' };
    throw error;
  }
}
module.exports = { saveCatalog, slugify };
