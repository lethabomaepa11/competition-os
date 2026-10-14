"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Space, Table } from "antd";
import type { TableColumnsType, TableProps } from "antd";
import type { ColumnType, FilterValue, SorterResult } from "antd/es/table/interface";

export interface SystemTableQuery {
  page: number;
  pageSize: number;
  search: string;
  filters: Record<string, FilterValue | null>;
  sortField?: string;
  sortOrder?: "ascend" | "descend";
}

type SystemTableProps<T extends object> = Omit<TableProps<T>, "dataSource" | "pagination"> & {
  dataSource: T[];
  searchText: (record: T) => string;
  loading?: boolean;
  pageSize?: number;
  tableId?: string;
  server?: { total: number; onChange: (query: SystemTableQuery) => void };
};

export function SystemTable<T extends object>({ dataSource, searchText, loading = false, pageSize: defaultPageSize = 10, tableId = "records", server, ...tableProps }: SystemTableProps<T>) {
  const prefix = tableId.replace(/[^a-z0-9_-]/gi, "").toLowerCase();
  const initialized = useRef(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [filters, setFilters] = useState<Record<string, FilterValue | null>>({});
  const [sort, setSort] = useState<{ field?: string; order?: "ascend" | "descend" }>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // URL state is an external navigation source and is intentionally restored after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(params.get(`${prefix}_q`) ?? "");
    setPage(Math.max(1, Number(params.get(`${prefix}_page`) ?? 1) || 1));
    setPageSize(Math.min(100, Math.max(1, Number(params.get(`${prefix}_size`) ?? defaultPageSize) || defaultPageSize)));
    const savedFilters = params.get(`${prefix}_filters`);
    if (savedFilters) {
      try { setFilters(JSON.parse(savedFilters) as Record<string, FilterValue | null>); } catch { /* malformed URL state is ignored */ }
    }
    const field = params.get(`${prefix}_sort`) ?? undefined;
    const order = params.get(`${prefix}_order`);
    setSort({ field, order: order === "ascend" || order === "descend" ? order : undefined });
    initialized.current = true;
  }, [defaultPageSize, prefix]);

  useEffect(() => {
    if (!initialized.current) return;
    const params = new URLSearchParams(window.location.search);
    const setOrDelete = (key: string, value?: string) => value ? params.set(key, value) : params.delete(key);
    setOrDelete(`${prefix}_q`, query.trim());
    setOrDelete(`${prefix}_page`, page > 1 ? String(page) : undefined);
    setOrDelete(`${prefix}_size`, pageSize !== defaultPageSize ? String(pageSize) : undefined);
    setOrDelete(`${prefix}_filters`, Object.keys(filters).length ? JSON.stringify(filters) : undefined);
    setOrDelete(`${prefix}_sort`, sort.field);
    setOrDelete(`${prefix}_order`, sort.order);
    const next = `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }, [defaultPageSize, filters, page, pageSize, prefix, query, sort]);

  useEffect(() => {
    if (!initialized.current || !server) return;
    const timeout = window.setTimeout(() => server.onChange({ page, pageSize, search: query.trim(), filters, sortField: sort.field, sortOrder: sort.order }), query ? 250 : 0);
    return () => window.clearTimeout(timeout);
  }, [filters, page, pageSize, query, server, sort]);

  const filteredData = useMemo(() => {
    if (server) return dataSource;
    const term = query.trim().toLocaleLowerCase();
    if (!term) return dataSource;
    return dataSource.filter((record) => searchText(record).toLocaleLowerCase().includes(term));
  }, [dataSource, query, searchText, server]);
  const columns = useMemo<TableColumnsType<T>>(() => (tableProps.columns ?? []).map((column) => {
    const typed = column as ColumnType<T>;
    const dataIndex = typed.dataIndex;
    if (!dataIndex) return typed;
    const path = Array.isArray(dataIndex) ? dataIndex : [dataIndex];
    const key = String(typed.key ?? path.join("."));
    const getValue = (record: T): unknown => path.reduce<unknown>((value, pathKey) => value !== null && typeof value === "object" ? (value as Record<string, unknown>)[String(pathKey)] : undefined, record);
    const values = [...new Set(dataSource.map(getValue).filter((value): value is string | number | boolean => ["string", "number", "boolean"].includes(typeof value)).map(String))];
    const autoFilters = values.length > 1 && values.length <= 12 ? values.map((value) => ({ text: value.replaceAll("_", " "), value })) : undefined;
    return {
      ...typed,
      filteredValue: filters[key] ?? null,
      sortOrder: sort.field === String(dataIndex) || sort.field === key ? sort.order : null,
      sorter: typed.sorter ?? (server ? true : ((a: T, b: T) => {
        const left = getValue(a);
        const right = getValue(b);
        if (typeof left === "number" && typeof right === "number") return left - right;
        return String(left ?? "").localeCompare(String(right ?? ""), undefined, { numeric: true, sensitivity: "base" });
      })),
      filters: typed.filters ?? autoFilters,
      onFilter: typed.onFilter ?? (!server && autoFilters ? ((value, record) => String(getValue(record) ?? "") === String(value)) : undefined),
    };
  }), [dataSource, filters, server, sort, tableProps.columns]);

  const total = server?.total ?? filteredData.length;
  return (
    <div className="system-table">
      <Space wrap style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <Input.Search aria-label="Search table" placeholder="Search records" allowClear value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} style={{ width: 320, maxWidth: "100%" }} />
        <Space size={8}>
          <span aria-live="polite">{total} {total === 1 ? "record" : "records"}</span>
          {(query || Object.keys(filters).length > 0) && <Button type="link" onClick={() => { setQuery(""); setFilters({}); setPage(1); }}>Clear filters</Button>}
        </Space>
      </Space>
      <Table<T>
        {...tableProps}
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        onChange={(pagination, nextFilters, sorter, extra) => {
          const selectedSorter = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<T>;
          setPage(pagination.current ?? 1);
          setPageSize(pagination.pageSize ?? pageSize);
          setFilters(Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value?.length)));
          setSort({ field: selectedSorter.field ? String(selectedSorter.field) : undefined, order: selectedSorter.order ?? undefined });
          tableProps.onChange?.(pagination, nextFilters, sorter, extra);
        }}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], showTotal: (count, range) => `${range[0]}–${range[1]} of ${count}` }}
      />
    </div>
  );
}
