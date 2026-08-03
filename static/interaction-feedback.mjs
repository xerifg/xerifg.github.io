export function createNotice(id, message, tone = "success") {
  return { id, message, tone };
}

export function pushNotice(queue, notice, limit = 3) {
  return [...queue.filter((item) => item.id !== notice.id), notice].slice(-limit);
}

export function dismissNotice(queue, id) {
  return queue.filter((item) => item.id !== id);
}
