"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, Breadcrumb, Button, Card, Checkbox, Empty, Input, Select, Space, Spin, Typography, message, Modal, Tag } from "antd";
import { DeleteOutlined, DownOutlined, HolderOutlined, PlusOutlined, SaveOutlined, ThunderboltOutlined, UpOutlined } from "@ant-design/icons";
import { CompetitionService } from "@/domain/services/competition.service";
import type { Competition } from "@/domain/competition";
import { canManageCompetition } from "@/lib/permissions";
import { useApp } from "@/lib/app-context";
import { createCustomCompetitionPage, ensureRequiredCompetitionPages, type CompetitionBlockType, type CompetitionPage } from "@/domain/competition-pages";
import styles from "./pages.module.css";

const { Title, Text } = Typography;
const blockOptions: { value: CompetitionBlockType; label: string }[] = [
  { value: "hero", label: "Hero and identity" },
  { value: "rich_text", label: "Text and details" },
  { value: "event_list", label: "Event programme" },
  { value: "standings", label: "Standings" },
  { value: "bracket", label: "Bracket" },
  { value: "results", label: "Fixtures and results" },
  { value: "statistics", label: "Competition statistics" },
  { value: "sponsors", label: "Partners and sponsors" },
  { value: "call_to_action", label: "Call to action" },
];

export default function CompetitionPagesEditor() {
  const params = useParams<{ orgSlug: string; compId: string }>();
  const router = useRouter();
  const { currentOrg, currentMember } = useApp();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [pages, setPages] = useState<CompetitionPage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<CompetitionPage["blocks"]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!currentOrg || !currentMember) return;
      const [item, allowed] = await Promise.all([
        new CompetitionService().get(params.compId),
        canManageCompetition(currentMember.id, currentOrg.id),
      ]);
      if (!active) return;
      if (!item || item.organizationId !== currentOrg.id) {
        message.error("Competition not found");
        router.push(`/o/${currentOrg.slug}/competitions`);
        return;
      }
      const normalized = ensureRequiredCompetitionPages(item.pages ?? []);
      setCompetition(item);
      setPages(normalized);
      setSelectedId(normalized[0]?.id ?? "");
      setAuthorized(allowed);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [currentOrg, currentMember, params.compId, router]);

  const selected = pages.find((page) => page.id === selectedId) ?? pages[0];
  const updateSelected = (updates: Partial<CompetitionPage>) => {
    if (!selected) return;
    setPages((items) => items.map((page) => page.id === selected.id ? { ...page, ...updates } : page));
  };
  const updateBlock = (blockId: string, updates: Partial<CompetitionPage["blocks"][number]>) => {
    if (!selected) return;
    updateSelected({ blocks: selected.blocks.map((block) => block.id === blockId ? { ...block, ...updates } : block) });
  };
  const addBlock = () => {
    if (!selected) return;
    const id = globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36);
    updateSelected({ blocks: [...selected.blocks, { id, type: "rich_text", title: "New section", body: "Add information for your audience." }] });
  };
  const addPage = () => {
    const page = createCustomCompetitionPage(pages.filter((item) => item.kind === "custom").length + 1);
    setPages((items) => [...items, page]);
    setSelectedId(page.id);
  };
  const reorderBlock = (targetIndex: number) => {
    if (dragIndex === null || !selected || dragIndex === targetIndex) return;
    moveBlock(dragIndex, targetIndex);
    setDragIndex(null);
  };
  const moveBlock = (fromIndex: number, targetIndex: number) => {
    if (!selected || fromIndex < 0 || targetIndex < 0 || fromIndex >= selected.blocks.length || targetIndex >= selected.blocks.length || fromIndex === targetIndex) return;
    const blocks = [...selected.blocks];
    const [dragged] = blocks.splice(fromIndex, 1);
    blocks.splice(targetIndex, 0, dragged);
    updateSelected({ blocks });
  };
  const save = async () => {
    if (!competition || !currentMember || !authorized) return;
    const slugs = pages.map((page) => page.slug.trim().toLowerCase());
    if (slugs.some((slug) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) || new Set(slugs).size !== slugs.length) {
      message.error("Page links must use unique lowercase letters, numbers, and hyphens");
      return;
    }
    for (const page of pages) {
      for (const block of page.blocks.filter((item) => item.type === "call_to_action" && item.href)) {
        const href = block.href!.trim();
        if (href.startsWith("page:")) {
          const target = pages.find((item) => item.slug === href.slice(5) && item.enabled);
          if (!target) { message.error(`The link in ${page.name} points to a page that is missing or unpublished`); return; }
        } else if (!(/^https:\/\//i.test(href) || (href.startsWith("/") && !href.startsWith("//")))) {
          message.error(`Use an https:// URL, a local path, or choose a competition page for the link in ${page.name}`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const updated = await new CompetitionService().update(competition.id, { pages }, currentMember.id);
      if (updated) setCompetition(updated);
      message.success("Competition pages saved");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Could not save page changes");
    } finally {
      setSaving(false);
    }
  };

  const generateDraft = async () => {
    if (!selected || !aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const response = await fetch("/api/ai/page-draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ competitionId: competition?.id, pageKind: selected.kind, prompt: aiPrompt.trim() }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not draft page sections");
      setAiDraft(json.data.blocks);
      message.success("Draft ready to review. It has not been saved or published.");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Could not draft page sections");
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiDraft = () => {
    if (!selected || !aiDraft.length) return;
    setPages((items) => items.map((page) => page.id === selected.id ? { ...page, blocks: aiDraft } : page));
    setAiOpen(false);
    setAiDraft([]);
    setAiPrompt("");
  };

  if (loading) return <div className="page-loading"><Spin size="large" /></div>;
  if (!competition || !currentOrg) return null;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      <Breadcrumb items={[
        { title: <Link href={`/o/${currentOrg.slug}/competitions`}>Competitions</Link> },
        { title: <Link href={`/o/${currentOrg.slug}/competitions/${competition.id}`}>{competition.name}</Link> },
        { title: "Public pages" },
      ]} />
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", margin: "20px 0" }}>
        <div><Text type="secondary">Public experience · {competition.name}</Text><Title level={2} style={{ margin: "4px 0" }}>Build competition pages</Title><Text type="secondary">Arrange sections, control navigation and preview the public address.</Text></div>
        <Space wrap>{authorized && <Button icon={<ThunderboltOutlined />} onClick={() => { setAiDraft([]); setAiOpen(true); }}>Draft with AI</Button>}<Button onClick={() => window.open(`/c/${competition.id}`, "_blank")}>Preview page</Button><Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>Save pages</Button></Space>
      </div>
      {!authorized ? <Alert type="error" showIcon title="Owner or admin access required to edit public pages." /> : (
        <div className={styles.layout}>
          <Card title="Page navigation" extra={<Button aria-label="Add page" icon={<PlusOutlined />} onClick={addPage} />}>
            <Space orientation="vertical" style={{ width: "100%" }}>
              {pages.map((page) => (
                <Button key={page.id} type={page.id === selected?.id ? "primary" : "default"} block style={{ textAlign: "left", height: "auto", padding: "10px 12px" }} onClick={() => setSelectedId(page.id)}>
                  <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>{page.name}</span><Text type="secondary">{page.kind === "custom" ? "Custom" : "Required"}</Text></span>
                </Button>
              ))}
            </Space>
          </Card>
          {selected ? (
            <Space orientation="vertical" size={16} style={{ width: "100%" }}>
              <Card title="Page details" extra={selected.kind === "custom" ? <Button danger type="text" icon={<DeleteOutlined />} onClick={() => { setPages((items) => items.filter((page) => page.id !== selected.id)); setSelectedId(pages.find((page) => page.id !== selected.id)?.id ?? ""); }}>Delete page</Button> : <Text type="secondary">Required page</Text>}>
                <div className={styles.pageFields}>
                  <label>Navigation label<Input value={selected.name} disabled={selected.kind !== "custom"} onChange={(event) => updateSelected({ name: event.target.value })} maxLength={48} /></label>
                  <label>Page link<Space.Compact style={{ width: "100%" }}><Input value="?page=" readOnly disabled={selected.kind !== "custom"} /><Input aria-label="Page slug" value={selected.slug} disabled={selected.kind !== "custom"} onChange={(event) => updateSelected({ slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} maxLength={48} /></Space.Compact></label>
                </div>
                <Checkbox checked={selected.enabled} disabled={selected.kind === "home" || selected.kind === "live"} onChange={(event) => updateSelected({ enabled: event.target.checked })} style={{ marginTop: 16 }}>{selected.kind === "invite" ? "Show Join link on Home and publish this page" : "Publish this page"}</Checkbox>
              </Card>
              <Card title="Page sections" extra={<Button icon={<PlusOutlined />} onClick={addBlock}>Add section</Button>}>
                {selected.blocks.length === 0 ? <Empty description="Add a section to start building this page." /> : (
                  <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                    {selected.blocks.map((block, index) => (
                      <Card key={block.id} size="small" draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderBlock(index)} onDragEnd={() => setDragIndex(null)} title={<Space><HolderOutlined /><span>Section {index + 1}</span></Space>} extra={<Space size={0}><Button type="text" aria-label={`Move section ${index + 1} up`} icon={<UpOutlined />} disabled={index === 0} onClick={() => moveBlock(index, index - 1)} /><Button type="text" aria-label={`Move section ${index + 1} down`} icon={<DownOutlined />} disabled={index === selected.blocks.length - 1} onClick={() => moveBlock(index, index + 1)} /><Button danger type="text" aria-label={`Remove section ${index + 1}`} icon={<DeleteOutlined />} onClick={() => updateSelected({ blocks: selected.blocks.filter((item) => item.id !== block.id) })} /></Space>}>
                        <Space orientation="vertical" style={{ width: "100%" }}>
                          <Select aria-label="Section type" value={block.type} options={blockOptions} onChange={(type: CompetitionBlockType) => updateBlock(block.id, { type })} style={{ width: "100%" }} />
                          <Input aria-label="Section heading" placeholder="Section heading" value={block.title ?? ""} onChange={(event) => updateBlock(block.id, { title: event.target.value })} />
                          {(["rich_text", "call_to_action", "sponsors"].includes(block.type)) && <Input.TextArea aria-label="Section text" value={block.body ?? ""} onChange={(event) => updateBlock(block.id, { body: event.target.value })} rows={3} placeholder="Explain what your audience needs to know" />}
                          {block.type === "call_to_action" && <>
                            <Select aria-label="Link to a competition page" allowClear placeholder="Link to a competition page" value={block.href?.startsWith("page:") ? block.href : undefined} onChange={(value) => updateBlock(block.id, { href: value })} options={pages.filter((page) => page.enabled && page.id !== selected.id).map((page) => ({ value: `page:${page.slug}`, label: `Page: ${page.name}` }))} />
                            <Input aria-label="Section link" value={block.href?.startsWith("page:") ? "" : block.href ?? ""} onChange={(event) => updateBlock(block.id, { href: event.target.value })} placeholder="/register or https://example.com" />
                          </>}
                          <Text type="secondary">Drag this section to change its position.</Text>
                        </Space>
                      </Card>
                    ))}
                  </Space>
                )}
              </Card>
              <Alert type="info" showIcon title="Required links are managed for you" description={`Home always links to the Live view.${pages.find((page) => page.kind === "invite")?.enabled ? " Join is also linked from Home because the Invite page is published." : " Publish the Invite page to add the Join link to Home."}`} />
            </Space>
          ) : <Empty description="Choose a page to edit" />}
        </div>
      )}
      <Modal title={aiDraft.length ? "Review AI page draft" : "Draft page sections with AI"} open={aiOpen} onCancel={() => { if (!aiLoading) setAiOpen(false); }} onOk={aiDraft.length ? applyAiDraft : generateDraft} okText={aiDraft.length ? "Use this draft" : "Generate draft"} confirmLoading={aiLoading} okButtonProps={{ disabled: !aiDraft.length && aiPrompt.trim().length < 4 }}>
        {aiDraft.length ? <><Alert type="info" showIcon message="This draft is not saved or published." description="Review every section and check factual details. You can edit the result before saving the page." /><Space orientation="vertical" style={{ width: "100%", marginTop: 16 }}>{aiDraft.map((block, index) => <Card key={block.id} size="small" title={`${index + 1}. ${block.title || block.type.replaceAll("_", " ")}`}><Typography.Paragraph>{block.body || "No supporting copy generated."}</Typography.Paragraph><Tag color="blue">{block.type.replaceAll("_", " ")}</Tag></Card>)}</Space></> : <><p>Tell the AI what this page should help a participant or audience member understand. It uses your competition description and event names as context.</p><Input.TextArea aria-label="AI page direction" value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} rows={5} maxLength={1000} placeholder="For example: Explain how clubs qualify, what captains should prepare, and where matchday updates appear." showCount /><Text type="secondary">Generated copy is a starting point. It will never publish automatically, and the AI must not invent results or eligibility rules.</Text></>}
      </Modal>
    </div>
  );
}
