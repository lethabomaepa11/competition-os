"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, Breadcrumb, Button, Card, Checkbox, Empty, Input, Segmented, Select, Space, Spin, Tag, Typography, message, Modal } from "antd";
import { AimOutlined, ApartmentOutlined, BarChartOutlined, CalendarOutlined, CloseOutlined, CopyOutlined, DeleteOutlined, DesktopOutlined, DownOutlined, EditOutlined, EyeOutlined, FileOutlined, FileTextOutlined, GoldOutlined, HolderOutlined, HomeOutlined, MobileOutlined, PlusOutlined, ProfileOutlined, SaveOutlined, SettingOutlined, TeamOutlined, ThunderboltOutlined, TrophyOutlined, UnorderedListOutlined, UpOutlined, UserAddOutlined } from "@ant-design/icons";
import { CompetitionService } from "@/domain/services/competition.service";
import { EventService } from "@/domain/services/event.service";
import { RegistrationService } from "@/domain/services/registration.service";
import { EventStatus, MatchStatus } from "@/domain/types";
import { CompetitionPageCanvas, type PreviewEvent } from "@/components/competition/competition-page-canvas";
import type { Competition } from "@/domain/competition";
import { canManageCompetition } from "@/lib/permissions";
import { useApp } from "@/lib/app-context";
import { createCustomCompetitionPage, ensureRequiredCompetitionPages, validateCompetitionPages, type CompetitionBlockType, type CompetitionPage, type CompetitionPageBlock } from "@/domain/competition-pages";
import styles from "./pages.module.css";
import { PageLoader } from "@/components/common/page-loader";

const { Title, Text } = Typography;

const blockOptions: { value: CompetitionBlockType; label: string; icon: React.ReactNode }[] = [
  { value: "hero", label: "Hero and identity", icon: <EyeOutlined /> },
  { value: "rich_text", label: "Text and details", icon: <FileTextOutlined /> },
  { value: "event_list", label: "Event programme", icon: <UnorderedListOutlined /> },
  { value: "schedule", label: "Fixture schedule", icon: <CalendarOutlined /> },
  { value: "roster", label: "Entrants and roster", icon: <TeamOutlined /> },
  { value: "standings", label: "Standings", icon: <TrophyOutlined /> },
  { value: "bracket", label: "Bracket", icon: <ApartmentOutlined /> },
  { value: "results", label: "Fixtures and results", icon: <ProfileOutlined /> },
  { value: "statistics", label: "Competition statistics", icon: <BarChartOutlined /> },
  { value: "sponsors", label: "Partners and sponsors", icon: <GoldOutlined /> },
  { value: "call_to_action", label: "Call to action", icon: <AimOutlined /> },
];

const paletteCategories: { title: string; types: CompetitionBlockType[] }[] = [
  { title: "Core sections", types: ["hero", "rich_text", "event_list"] },
  { title: "Competition data", types: ["schedule", "roster", "standings", "bracket", "results", "statistics"] },
  { title: "Marketing", types: ["sponsors", "call_to_action"] },
];

const pageKindIcons: Record<CompetitionPage["kind"], React.ReactNode> = {
  home: <HomeOutlined />,
  invite: <UserAddOutlined />,
  live: <ThunderboltOutlined />,
  custom: <FileOutlined />,
};

const newBlockId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<CompetitionPage["blocks"]>([]);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "phone">("desktop");
  const [previewEvents, setPreviewEvents] = useState<PreviewEvent[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!currentOrg || !currentMember) return;
      try {
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
      setSelectedBlockId(normalized[0]?.blocks[0]?.id ?? "");
      setAuthorized(allowed);
      setPreviewLoading(true);
      void (async () => {
        try {
          const eventService = new EventService();
          const registrationService = new RegistrationService();
          const publishedEvents = (await eventService.list(item.id)).filter(
            (event) => event.status !== EventStatus.Draft && event.status !== EventStatus.Cancelled,
          );
          const data = await Promise.all(publishedEvents.map(async (event) => {
            const [participants, matches] = await Promise.all([
              registrationService.getParticipants(event.id),
              eventService.getMatches(event.id),
            ]);
            return {
              ...event,
              participantCount: participants.length,
              matchCount: matches.length,
              completedCount: matches.filter((match) => match.status === MatchStatus.Completed).length,
            };
          }));
          if (active) setPreviewEvents(data);
        } catch (cause) {
          if (active) setPreviewError(cause instanceof Error ? cause.message : "Competition data could not be loaded for the preview");
        } finally {
          if (active) setPreviewLoading(false);
        }
      })();
      } catch (cause) {
        if (active) message.error(cause instanceof Error ? cause.message : "Could not load competition pages");
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [currentOrg, currentMember, params.compId, router]);

  const selected = pages.find((page) => page.id === selectedId) ?? pages[0];
  const selectedBlock = selected?.blocks.find((block) => block.id === selectedBlockId);
  const selectedBlockIndex = selected && selectedBlock ? selected.blocks.indexOf(selectedBlock) : -1;
  const savedPages = useMemo(() => (competition ? ensureRequiredCompetitionPages(competition.pages ?? []) : []), [competition]);
  const dirty = useMemo(() => JSON.stringify(pages) !== JSON.stringify(savedPages), [pages, savedPages]);

  const updateSelected = (updates: Partial<CompetitionPage>) => {
    if (!selected) return;
    setPages((items) => items.map((page) => page.id === selected.id ? { ...page, ...updates } : page));
  };
  const updateBlock = (blockId: string, updates: Partial<CompetitionPageBlock>) => {
    if (!selected) return;
    updateSelected({ blocks: selected.blocks.map((block) => block.id === blockId ? { ...block, ...updates } : block) });
  };
  const addBlock = (type: CompetitionBlockType = "rich_text", atIndex?: number) => {
    if (!selected) return;
    const id = newBlockId();
    const block: CompetitionPageBlock = { id, type, title: blockOptions.find((option) => option.value === type)?.label };
    if (["rich_text", "call_to_action", "sponsors"].includes(type)) block.body = "Add information for your audience.";
    if (type === "call_to_action") block.href = "/";
    const blocks = [...selected.blocks];
    blocks.splice(atIndex ?? blocks.length, 0, block);
    updateSelected({ blocks });
    setSelectedBlockId(id);
    setDropIndex(null);
  };
  const addPage = () => {
    const page = createCustomCompetitionPage(pages.filter((item) => item.kind === "custom").length + 1);
    setPages((items) => [...items, page]);
    setSelectedId(page.id);
    setSelectedBlockId(page.blocks[0]?.id ?? "");
  };
  const moveBlock = (fromIndex: number, targetIndex: number) => {
    if (!selected || fromIndex < 0 || targetIndex < 0 || fromIndex >= selected.blocks.length || targetIndex >= selected.blocks.length || fromIndex === targetIndex) return;
    const blocks = [...selected.blocks];
    const [dragged] = blocks.splice(fromIndex, 1);
    blocks.splice(targetIndex, 0, dragged);
    updateSelected({ blocks });
    setDropIndex(null);
  };
  const removeBlock = (blockId: string) => {
    if (!selected) return;
    const index = selected.blocks.findIndex((block) => block.id === blockId);
    const blocks = selected.blocks.filter((block) => block.id !== blockId);
    updateSelected({ blocks });
    if (selectedBlockId === blockId) setSelectedBlockId(blocks[index === 0 ? 0 : index - 1]?.id ?? "");
  };
  const duplicateBlock = (blockId: string) => {
    if (!selected) return;
    const index = selected.blocks.findIndex((block) => block.id === blockId);
    const block = selected.blocks[index];
    if (!block) return;
    const copy: CompetitionPageBlock = { ...block, id: newBlockId() };
    const blocks = [...selected.blocks];
    blocks.splice(index + 1, 0, copy);
    updateSelected({ blocks });
    setSelectedBlockId(copy.id);
  };
  const handlePaletteDragStart = (event: React.DragEvent, type: CompetitionBlockType) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-competition-block-type", type);
  };
  const handleCanvasDrop = (event: React.DragEvent, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    const type = event.dataTransfer.getData("application/x-competition-block-type") as CompetitionBlockType;
    if (type && blockOptions.some((option) => option.value === type)) {
      addBlock(type, index);
      return;
    }
    const blockId = event.dataTransfer.getData("application/x-competition-block-id");
    if (blockId && selected) {
      const from = selected.blocks.findIndex((block) => block.id === blockId);
      if (from >= 0) {
        moveBlock(from, from < index ? index - 1 : index);
        setSelectedBlockId(blockId);
      }
    }
    setDropIndex(null);
  };
  const discardChanges = () => {
    setPages(ensureRequiredCompetitionPages(competition?.pages ?? []));
    setSelectedBlockId("");
    message.info("Unsaved page changes were discarded");
  };
  const save = async () => {
    if (!competition || !currentMember || !authorized) return;
    const validation = validateCompetitionPages(pages);
    if (!validation.pages) { message.error(validation.errors[0]); return; }
    setSaving(true);
    try {
      const response = await fetch(`/api/competitions/${competition.id}/pages`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pages: validation.pages }) });
      const json = await response.json() as { data?: { pages: CompetitionPage[] }; error?: string };
      if (!response.ok || !json.data) throw new Error(json.error ?? "Could not save page changes");
      setPages(json.data.pages);
      setCompetition({ ...competition, pages: json.data.pages });
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

  if (loading) return <PageLoader label="Loading page builder" />;
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
        <Space wrap>
          {authorized && <Button icon={<ThunderboltOutlined />} onClick={() => { setAiDraft([]); setAiOpen(true); }}>Draft with AI</Button>}
          {authorized && dirty && <Button onClick={discardChanges}>Discard changes</Button>}
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>Save pages</Button>
        </Space>
      </div>
      {!authorized ? <Alert type="error" showIcon title="Owner or admin access required to edit public pages." /> : (
        <div className={styles.builderLayout}>
          <aside className={styles.leftPane} aria-label="Pages and components">
            <div className={styles.pageTabs} aria-label="Competition pages">
              {pages.map((page) => (
                <button key={page.id} type="button" aria-current={page.id === selected?.id ? "page" : undefined} className={`${styles.pageTab} ${page.id === selected?.id ? styles.active : ""}`} onClick={() => { setSelectedId(page.id); setSelectedBlockId(page.blocks[0]?.id ?? ""); }}>
                  <span className={styles.pageTabIcon}>{pageKindIcons[page.kind]}</span>
                  <span className={styles.pageTabName}>{page.name}</span>
                  {!page.enabled && <span className={styles.pageTabDraft}>Draft</span>}
                  <span className={styles.pageTabKind}>{page.kind === "custom" ? "Custom" : "Required"}</span>
                </button>
              ))}
              <button type="button" className={styles.addPageButton} onClick={addPage} aria-label="Add page"><PlusOutlined /> Add page</button>
            </div>
            <div className={styles.paletteScroll}>
              {paletteCategories.map((category) => (
                <div key={category.title}>
                  <div className={styles.paletteSectionTitle}>{category.title}</div>
                  <div className={styles.palette}>
                    {category.types.map((type) => {
                      const option = blockOptions.find((item) => item.value === type)!;
                      return (
                        <div
                          key={type}
                          className={styles.paletteItem}
                          role="button"
                          tabIndex={0}
                          draggable
                          aria-label={`Add ${option.label} section`}
                          title={`Drag onto the canvas or press Enter to add ${option.label}`}
                          onDragStart={(event) => handlePaletteDragStart(event, type)}
                          onClick={() => addBlock(type)}
                          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); addBlock(type); } }}
                        >
                          <span className={styles.paletteItemIcon}>{option.icon}</span>
                          <span className={styles.paletteItemLabel}>{option.label}</span>
                          <HolderOutlined className={styles.paletteGrip} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <Alert className={styles.paletteHint} type="info" showIcon title="Drag a component onto the canvas, or click to add it to this page." />
            </div>
          </aside>
          <main className={styles.centerPane} aria-label="Page canvas">
            <div className={styles.canvasHeader}>
              <div className={styles.canvasTitle}>
                <span className={styles.canvasTitleText}>{selected?.name ?? "Page"}</span>
                <span className={styles.canvasTitleSub}>?page={selected?.slug}</span>
                {dirty && <Tag color="orange">Unsaved changes</Tag>}
              </div>
              <div className={styles.canvasActions}>
                {previewLoading && <Spin size="small" aria-label="Loading competition data" />}
                <Segmented value={previewViewport} onChange={(value) => setPreviewViewport(value as "desktop" | "phone")} options={[{ value: "desktop", label: "Desktop", icon: <DesktopOutlined /> }, { value: "phone", label: "Phone", icon: <MobileOutlined /> }]} aria-label="Preview viewport" />
              </div>
            </div>
            {previewError && <div className={styles.canvasStatus}><Alert type="warning" showIcon closable title="Live competition data could not be fully loaded for the preview." description={previewError} onClose={() => setPreviewError("")} /></div>}
            <div className={styles.canvasViewport}>
              {selected ? (
                <div className={previewViewport === "phone" ? `${styles.canvasFrame} ${styles.phone}` : styles.canvasFrame}>
                  <CompetitionPageCanvas competition={competition} page={selected} pages={pages} events={previewEvents} selectedBlockId={selectedBlockId} dropIndex={dropIndex} onSelectBlock={setSelectedBlockId} onDropAt={handleCanvasDrop} onHoverIndex={setDropIndex} />
                </div>
              ) : <Empty description="Choose a page to edit" />}
            </div>
          </main>

          <aside className={styles.rightPane} aria-label="Properties">
            <div className={styles.inspectorHeader}>
              <span className={styles.inspectorTitle}><SettingOutlined className={styles.inspectorTitleIcon} /> Properties{selectedBlock && selected && <span className={styles.inspectorPosition}>Section {selectedBlockIndex + 1} of {selected.blocks.length}</span>}</span>
              {selectedBlock && <Button type="text" size="small" icon={<CloseOutlined />} aria-label="Close section settings" onClick={() => setSelectedBlockId("")} />}
            </div>
            <div className={styles.inspectorContent}>
              {selectedBlock && selected ? (
                <section className={styles.inspectorSection}>
                  <div className={styles.inspectorSectionTitle}>Section</div>
                  <div className={styles.inspectorField}>
                    <label className={styles.inspectorFieldLabel}>Component type</label>
                    <Select
                      aria-label="Section type"
                      value={selectedBlock.type}
                      style={{ width: "100%" }}
                      onChange={(type: CompetitionBlockType) => updateBlock(selectedBlock.id, { type })}
                      options={blockOptions.map((option) => ({ value: option.value, label: <span className={styles.blockTypeOption}><span className={styles.paletteItemIcon}>{option.icon}</span>{option.label}</span> }))}
                    />
                  </div>
                  <div className={styles.inspectorField}>
                    <label className={styles.inspectorFieldLabel}>Heading</label>
                    <Input aria-label="Section heading" placeholder="Section heading" value={selectedBlock.title ?? ""} onChange={(event) => updateBlock(selectedBlock.id, { title: event.target.value })} />
                  </div>
                  {["rich_text", "call_to_action", "sponsors"].includes(selectedBlock.type) && (
                    <div className={styles.inspectorField}>
                      <label className={styles.inspectorFieldLabel}>Text</label>
                      <Input.TextArea aria-label="Section text" value={selectedBlock.body ?? ""} onChange={(event) => updateBlock(selectedBlock.id, { body: event.target.value })} rows={4} placeholder="Explain what your audience needs to know" />
                    </div>
                  )}
                  {selectedBlock.type === "call_to_action" && (
                    <div className={styles.inspectorField}>
                      <label className={styles.inspectorFieldLabel}>Link</label>
                      <Space orientation="vertical" style={{ width: "100%" }}>
                        <Select aria-label="Link to a competition page" allowClear placeholder="Link to a competition page" style={{ width: "100%" }} value={selectedBlock.href?.startsWith("page:") ? selectedBlock.href : undefined} onChange={(value) => updateBlock(selectedBlock.id, { href: value })} options={pages.filter((page) => page.enabled && page.id !== selected.id).map((page) => ({ value: `page:${page.slug}`, label: `Page: ${page.name}` }))} />
                        <Input aria-label="Section link" value={selectedBlock.href?.startsWith("page:") ? "" : selectedBlock.href ?? ""} onChange={(event) => updateBlock(selectedBlock.id, { href: event.target.value })} placeholder="/register or https://example.com" />
                      </Space>
                    </div>
                  )}
                  <div className={styles.inspectorField}>
                    <label className={styles.inspectorFieldLabel}>Position and actions</label>
                    <div className={styles.inspectorActions}>
                      <Button icon={<UpOutlined />} aria-label={`Move section ${selectedBlockIndex + 1} up`} disabled={selectedBlockIndex === 0} onClick={() => moveBlock(selectedBlockIndex, selectedBlockIndex - 1)}>Move up</Button>
                      <Button icon={<DownOutlined />} aria-label={`Move section ${selectedBlockIndex + 1} down`} disabled={selectedBlockIndex === selected.blocks.length - 1} onClick={() => moveBlock(selectedBlockIndex, selectedBlockIndex + 1)}>Move down</Button>
                      <Button icon={<CopyOutlined />} aria-label="Duplicate section" onClick={() => duplicateBlock(selectedBlock.id)}>Duplicate</Button>
                      <Button danger icon={<DeleteOutlined />} aria-label="Remove section" onClick={() => removeBlock(selectedBlock.id)}>Remove</Button>
                    </div>
                    <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>Drag this section on the canvas to change its position, or use these buttons.</Text>
                  </div>
                </section>
              ) : selected ? (
                selected.blocks.length === 0 ? (
                  <section className={styles.inspectorSection}>
                    <div className={styles.inspectorEmpty}>
                      <HolderOutlined className={styles.inspectorEmptyIcon} />
                      <div className={styles.inspectorEmptyTitle}>No sections yet</div>
                      <div className={styles.inspectorEmptyText}>Drag a component from the left onto the canvas, or click one, to add the first section.</div>
                    </div>
                  </section>
                ) : (
                  <section className={styles.inspectorSection}>
                    <div className={styles.inspectorEmpty}>
                      <EditOutlined className={styles.inspectorEmptyIcon} />
                      <div className={styles.inspectorEmptyTitle}>No section selected</div>
                      <div className={styles.inspectorEmptyText}>Click any section on the canvas to edit its component type, heading, text and link here.</div>
                    </div>
                  </section>
                )
              ) : null}
              {selected && (
                <section className={styles.inspectorSection}>
                  <div className={styles.inspectorSectionTitle}>Page</div>
                  <div className={styles.inspectorField}>
                    <label className={styles.inspectorFieldLabel}>Navigation label</label>
                    <Input value={selected.name} disabled={selected.kind !== "custom"} onChange={(event) => updateSelected({ name: event.target.value })} maxLength={48} />
                  </div>
                  <div className={styles.inspectorField}>
                    <label className={styles.inspectorFieldLabel}>Page link</label>
                    <Space.Compact style={{ width: "100%" }}>
                      <Input value="?page=" readOnly disabled={selected.kind !== "custom"} />
                      <Input aria-label="Page slug" value={selected.slug} disabled={selected.kind !== "custom"} onChange={(event) => updateSelected({ slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} maxLength={48} />
                    </Space.Compact>
                  </div>
                  <Checkbox checked={selected.enabled} disabled={selected.kind === "home" || selected.kind === "live"} onChange={(event) => updateSelected({ enabled: event.target.checked })}>
                    {selected.kind === "invite" ? "Show Join link on Home and publish this page" : "Publish this page"}
                  </Checkbox>
                  {selected.kind === "custom" && (
                    <div style={{ marginTop: 12 }}>
                      <Button danger type="text" icon={<DeleteOutlined />} onClick={() => { setPages((items) => items.filter((page) => page.id !== selected.id)); setSelectedId(pages.find((page) => page.id !== selected.id)?.id ?? ""); setSelectedBlockId(""); }}>Delete page</Button>
                    </div>
                  )}
                </section>
              )}
              {selected && (
                <Alert type="info" showIcon style={{ marginTop: 4 }} title="Required links are managed for you" description={`Home always links to the Live view.${pages.find((page) => page.kind === "invite")?.enabled ? " Join is also linked from Home because the Invite page is published." : " Publish the Invite page to add the Join link to Home."}`} />
              )}
            </div>
          </aside>
        </div>
      )}
      <Modal title={aiDraft.length ? "Review AI page draft" : "Draft page sections with AI"} open={aiOpen} onCancel={() => { if (!aiLoading) setAiOpen(false); }} onOk={aiDraft.length ? applyAiDraft : generateDraft} okText={aiDraft.length ? "Use this draft" : "Generate draft"} confirmLoading={aiLoading} okButtonProps={{ disabled: !aiDraft.length && aiPrompt.trim().length < 4 }}>
        {aiDraft.length ? <><Alert type="info" showIcon message="This draft is not saved or published." description="Review every section and check factual details. You can edit the result before saving the page." /><Space orientation="vertical" style={{ width: "100%", marginTop: 16 }}>{aiDraft.map((block, index) => <Card key={block.id} size="small" title={`${index + 1}. ${block.title || block.type.replaceAll("_", " ")}`}><Typography.Paragraph>{block.body || "No supporting copy generated."}</Typography.Paragraph><Tag color="blue">{block.type.replaceAll("_", " ")}</Tag></Card>)}</Space></> : <><p>Tell the AI what this page should help a participant or audience member understand. It uses your competition description and event names as context.</p><Input.TextArea aria-label="AI page direction" value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} rows={5} maxLength={1000} placeholder="For example: Explain how clubs qualify, what captains should prepare, and where matchday updates appear." showCount /><Text type="secondary">Generated copy is a starting point. It will never publish automatically, and the AI must not invent results or eligibility rules.</Text></>}
      </Modal>
    </div>
  );
}
