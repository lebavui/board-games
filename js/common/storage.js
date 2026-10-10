// Lưu trữ localStorage có phiên bản cấu trúc dữ liệu.
// Mỗi bản ghi có dạng { v: <phiên bản>, savedAt: <ms>, data: <dữ liệu> }.

const PREFIX = 'tritue-banco:';

function storage() {
  try {
    const s = window.localStorage;
    const probe = PREFIX + '__probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null; // Chế độ riêng tư hoặc bị chặn: trò chơi vẫn chạy, chỉ không lưu.
  }
}

const store = typeof window !== 'undefined' ? storage() : null;

/**
 * Đọc dữ liệu. Nếu bản lưu CŨ hơn `version`, gọi `migrate(oldVersion, data)`;
 * hàm này trả về dữ liệu mới hoặc null để bỏ bản lưu cũ.
 * Bản lưu MỚI hơn (do phiên bản mã mới hơn ghi, ví dụ khi trình duyệt còn giữ mã cũ trong cache)
 * không bao giờ bị xóa hay ghi đè — chỉ trả về null.
 * `peek: true` chỉ đọc: không nâng cấp hay xóa bản lưu khác phiên bản (dùng ở trang chủ).
 */
export function load(key, { version = 1, migrate = null, peek = false } = {}) {
  if (!store) return null;
  try {
    const raw = store.getItem(PREFIX + key);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (!record || typeof record !== 'object' || !('v' in record)) return null;
    if (record.v === version) return record.data;
    if (peek || !(record.v < version)) return null;
    if (migrate) {
      const migrated = migrate(record.v, record.data);
      if (migrated != null) {
        save(key, migrated, version);
        return migrated;
      }
    }
    store.removeItem(PREFIX + key);
    return null;
  } catch {
    return null;
  }
}

export function save(key, data, version = 1) {
  if (!store) return false;
  try {
    // Không ghi đè bản lưu có cấu trúc mới hơn mã hiện tại hiểu được.
    const existing = store.getItem(PREFIX + key);
    if (existing) {
      const v = JSON.parse(existing)?.v;
      if (typeof v === 'number' && v > version) return false;
    }
    store.setItem(PREFIX + key, JSON.stringify({ v: version, savedAt: Date.now(), data }));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  if (!store) return;
  try { store.removeItem(PREFIX + key); } catch { /* bỏ qua */ }
}

/** Cài đặt: gộp với giá trị mặc định để thêm khóa mới không làm hỏng bản lưu cũ. */
export function loadSettings(key, defaults, version = 1) {
  const data = load(`settings:${key}`, { version });
  return { ...defaults, ...(data && typeof data === 'object' ? data : {}) };
}

export function saveSettings(key, settings, version = 1) {
  return save(`settings:${key}`, settings, version);
}
