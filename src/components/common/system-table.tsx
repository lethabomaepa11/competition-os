"use client";

import { useMemo, useState } from "react";
import { Button, Input, Space, Table } from "antd";
import type { TableColumnsType, TableProps } from "antd";
import type { ColumnType } from "antd/es/table";

type SystemTableProps<T extends object> = Omit<TableProps<T>, "dataSource" | "pagination"> & {
  dataSource: T[];
  searchText: (record: T) => string;
  loading?: boolean;
  pageSize?: number;
};

export function SystemTable<T extends object>({ dataSource, searchText, loading = false, pageSize = 10, ...tableProps }: SystemTableProps<T>) {
  const [query, setQuery] = useState("");
  const filteredData = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return dataSource;
    return dataSource.filter((record) => searchText(record).toLocaleLowerCase().includes(term));
  }, [dataSource, query, searchText]);
  const columns = useMemo<TableColumnsType<T>>(() => (tableProps.columns ?? []).map((column) => {
    const typed = column as ColumnType<T>;
    const dataIndex = typed.dataIndex;
    if (!dataIndex) return typed;
    const path = Array.isArray(dataIndex) ? dataIndex : [dataIndex];
    const getValue = (record: T): unknown => path.reduce<unknown>((value, key) => value !== null && typeof value === "object" ? (value as Record<string, unknown>)[String(key)] : undefined, record);
    const values = [...new Set(dataSource.map(getValue).filter((value): value is string | number | boolean => ["string", "number", "boolean"].includes(typeof value)).map(String))];
    const autoFilters = values.length > 1 && values.length <= 12 ? values.map((value) => ({ text: value.replaceAll("_", " "), value })) : undefined;
    return {
      ...typed,
      sorter: typed.sorter ?? ((a: T, b: T) => {
        const left = getValue(a);
        const right = getValue(b);
        if (typeof left === "number" && typeof right === "number") return left - right;
        return String(left ?? "").localeCompare(String(right ?? ""), undefined, { numeric: true, sensitivity: "base" });
      }),
      filters: typed.filters ?? autoFilters,
      onFilter: typed.onFilter ?? (autoFilters ? ((value, record) => String(getValue(record) ?? "") === String(value)) : undefined),
    };
  }), [dataSource, tableProps.columns]);

  return (
    <div className="system-table">
      <Space wrap style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <Input.Search aria-label="Search table" placeholder="Search records" allowClear value={query} onChange={(event) => setQuery(event.target.value)} style={{ width: 320, maxWidth: "100%" }} />
        <Space size={8}>
          <span aria-live="polite">{filteredData.length} {filteredData.length === 1 ? "record" : "records"}</span>
          {query && <Button type="link" onClick={() => setQuery("")}>Clear search</Button>}
        </Space>
      </Space>
      <Table<T>
        {...tableProps}
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        pagination={{
          pageSize,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          showTotal: (total, range) => `${range[0]}–${range[1]} of ${total}`,
        }}
      />
    </div>
  );
}
