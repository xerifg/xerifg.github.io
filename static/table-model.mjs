function normalizedValue(value) {
  return String(value ?? "").trim();
}

export function compareTableValues(left, right) {
  const leftValue = normalizedValue(left);
  const rightValue = normalizedValue(right);
  if (!leftValue && !rightValue) return 0;
  if (!leftValue) return 1;
  if (!rightValue) return -1;

  const leftNumber = Number(leftValue);
  const rightNumber = Number(rightValue);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  return leftValue.localeCompare(rightValue, undefined, { sensitivity: "base", numeric: true });
}

export function sortTableRows(rows, columnIndex, direction = "asc") {
  if (!Number.isInteger(columnIndex) || columnIndex < 0 || rows.length < 2) return rows;
  const [header, ...body] = rows;
  if (!body.every((row) => Array.isArray(row.values) && columnIndex < row.values.length)) return rows;
  const factor = direction === "desc" ? -1 : 1;
  const sortedBody = body
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const result = compareTableValues(left.row.values[columnIndex], right.row.values[columnIndex]);
      const blankResult = !normalizedValue(left.row.values[columnIndex]) || !normalizedValue(right.row.values[columnIndex]);
      return (blankResult ? result : result * factor) || left.index - right.index;
    })
    .map(({ row }) => row);
  return [header, ...sortedBody];
}
