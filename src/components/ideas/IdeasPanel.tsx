import { useMemo, useRef, useEffect, forwardRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Sparkles, Globe, Star, ChevronsRight, List, Image as ImageIcon } from 'lucide-react';
import { db } from '@/lib/db';
import { useStore, IDEAS_MIN_WIDTH, IDEAS_DEFAULT_WIDTH } from '@/lib/store';
import { useFilteredIdeas, useGlobalSearchIdeas, useAllProjects, UNASSIGNED_PROJECT_ID, type EnrichedIdea } from '@/hooks/useIdeas';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CopyButton } from './CopyButton';
import { computeRarity, computeGrowthLevel } from '@/lib/game';
import { RarityBadge, growthEmoji } from '@/components/game/badges';

interface IdeasPanelProps {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

/**
 * 右栏：灵感卡片列表（浏览/选择）
 * - 搜索 + 标签筛选
 * - 全局搜索 / 项目内搜索自动切换
 * - 卡片列表（全局模式附带来源信息）
 * - 空状态
 */
export const IdeasPanel = forwardRef<HTMLDivElement, IdeasPanelProps>(
  function IdeasPanel({ searchInputRef }, ref) {
    const selectedProjectId = useStore((s) => s.selectedProjectId);
    const searchQuery = useStore((s) => s.searchQuery);
    const setSearchQuery = useStore((s) => s.setSearchQuery);
    const activeTags = useStore((s) => s.activeTags);
    const toggleTag = useStore((s) => s.toggleTag);
    const setSelectedProjectId = useStore((s) => s.setSelectedProjectId);
    const setSelectedCategoryId = useStore((s) => s.setSelectedCategoryId);
    const setSelectedIdeaId = useStore((s) => s.setSelectedIdeaId);
    const openEditor = useStore((s) => s.openEditor);
    const openCard = useStore((s) => s.openCard);

    const isGlobalSearch = useStore((s) => s.isGlobalSearch);

    const ideasWidth = useStore((s) => s.ideasWidth);
    const isIdeasCollapsed = useStore((s) => s.isIdeasCollapsed);
    const setIdeasWidth = useStore((s) => s.setIdeasWidth);
    const toggleIdeas = useStore((s) => s.toggleIdeas);
    const setIdeasCollapsed = useStore((s) => s.setIdeasCollapsed);

    // 拖拽调整宽度
    const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

    const onResizeStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startWidth: ideasWidth };
      document.body.classList.add('select-none');
      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current) return;
        // 右栏左侧边缘向左拉变窄、向右拉变宽
        const delta = dragRef.current.startX - ev.clientX;
        setIdeasWidth(dragRef.current.startWidth + delta);
      };
      const onUp = () => {
        dragRef.current = null;
        document.body.classList.remove('select-none');
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    }, [ideasWidth, setIdeasWidth]);

    // 拖拽过程中若宽度达到最小时自动折叠
    useEffect(() => {
      if (ideasWidth <= IDEAS_MIN_WIDTH && !isIdeasCollapsed) {
        setIdeasCollapsed(true);
      }
    }, [ideasWidth, isIdeasCollapsed, setIdeasCollapsed]);

    // 展开时恢复默认宽度
    const handleToggleIdeas = () => {
      if (isIdeasCollapsed) {
        setIdeasWidth(IDEAS_DEFAULT_WIDTH);
      }
      toggleIdeas();
    };

    // 项目内搜索
    const projectIdeas = useFilteredIdeas(selectedProjectId, searchQuery, activeTags);
    // 全局搜索
    const globalResults = useGlobalSearchIdeas(searchQuery, activeTags);
    // 所有项目（用于查找 categoryId 以导航）
    const allProjects = useAllProjects();
    const projectMap = useMemo(
      () => new Map(allProjects.map((p) => [p.id!, p])),
      [allProjects]
    );

    // 当前展示的灵感列表（全局模式下 idea 附带 categoryName / projectName）
    const ideas = (isGlobalSearch ? globalResults : projectIdeas) as EnrichedIdea[];

    // 从当前 ideas 中提取所有 tags
    const allTags = useMemo(() => {
      const tagSet = new Set<string>();
      ideas.forEach((idea) => idea.tags.forEach((t) => tagSet.add(t)));
      return [...tagSet].sort();
    }, [ideas]);

    // 用于滚动到被选中的灵感
    const highlightIdeaId = useRef<number | null>(null);

    useEffect(() => {
      if (highlightIdeaId.current != null) {
        const el = document.getElementById(`idea-card-${highlightIdeaId.current}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        // 清除高亮标记，延迟以让动画完成
        const id = highlightIdeaId.current;
        setTimeout(() => {
          if (highlightIdeaId.current === id) {
            highlightIdeaId.current = null;
          }
        }, 2000);
      }
    }, [selectedProjectId]);

    const handleCardClick = (ideaId: number) => {
      setSelectedIdeaId(ideaId);
      openEditor(ideaId);
    };

    /** 全局搜索结果点击：跳转到对应项目并选中灵感 */
    const handleGlobalCardClick = (ideaId: number, projectId: number | null) => {
      if (projectId == null) {
        // 未分配灵感：跳转到「未分配」入口
        setSelectedCategoryId(null);
        setSelectedProjectId(UNASSIGNED_PROJECT_ID);
        setSelectedIdeaId(ideaId);
        highlightIdeaId.current = ideaId;
        openEditor(ideaId);
        return;
      }
      const project = projectMap.get(projectId);
      if (project) {
        setSelectedCategoryId(project.categoryId);
        setSelectedProjectId(projectId);
        setSelectedIdeaId(ideaId);
        highlightIdeaId.current = ideaId;
        openEditor(ideaId);
      }
    };

    const handleNewIdea = () => {
      setSelectedIdeaId(null);
      openEditor();
    };

    const toggleFavorite = async (e: React.MouseEvent, ideaId: number, current: boolean) => {
      e.stopPropagation();
      await db.ideas.update(ideaId, { isFavorite: !current });
    };

    return (
      <>
        {/* 折叠态：左侧窄条展开按钮 */}
        <AnimatePresence initial={false}>
        {isIdeasCollapsed && (
          <motion.button
            key="ideas-collapsed"
            onClick={handleToggleIdeas}
            className="shrink-0 w-9 flex flex-col items-center py-3 gap-2 border-l border-border bg-sidebar hover:bg-accent/50 transition-colors"
            title="展开灵感列表"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 36, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <ChevronsRight className="size-4 text-muted-foreground rotate-180" strokeWidth={1.5} />
            <List className="size-3.5 text-green-600" strokeWidth={1.5} />
          </motion.button>
        )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
        {!isIdeasCollapsed && (
        <motion.div
          ref={ref}
          className="relative shrink-0 border-l border-border bg-background flex flex-col overflow-hidden"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: ideasWidth, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          {/* 拖拽调整宽度手柄（在左侧边缘，与左侧边栏对称） */}
          <div
            onPointerDown={onResizeStart}
            className="absolute top-0 left-0 bottom-0 w-1.5 z-10 cursor-col-resize group/resize"
          >
            <div className="absolute inset-y-0 left-0 w-[3px] bg-transparent transition-colors group-hover/resize:bg-green-500 group-active/resize:bg-green-500" />
          </div>

          {/* 顶部搜索栏 */}
          <div className="sticky top-0 z-10 border-b border-border bg-background p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                {isGlobalSearch ? (
                  <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" strokeWidth={1.5} />
                ) : (
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" strokeWidth={1.5} />
                )}
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isGlobalSearch ? '全局搜索灵感...' : '搜索灵感...'}
                  className="pl-8"
                />
              </div>
              <Button size="icon" onClick={handleNewIdea} title="新建灵感 (Ctrl+N)">
                <Plus strokeWidth={1.5} />
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={handleToggleIdeas} title="收起灵感列表">
                <ChevronsRight className="size-4 rotate-180" strokeWidth={1.5} />
              </Button>
            </div>
            {/* 全局搜索模式提示 */}
            {isGlobalSearch && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Globe className="size-3" strokeWidth={1.5} />
                <span>搜索所有项目</span>
              </div>
            )}
            {/* 标签 chips */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={activeTags.includes(tag) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* 卡片列表 */}
          <ScrollArea className="flex-1">
            <div className="p-3 flex flex-col gap-2">
              <AnimatePresence mode="popLayout">
              {ideas.length === 0 ? (
                <EmptyState isGlobal={isGlobalSearch} hasQuery={!!searchQuery.trim()} onNew={handleNewIdea} />
              ) : (
                ideas.map((idea) => {
                  const isHighlighted = highlightIdeaId.current === idea.id;
                  const rarity = computeRarity(idea);
                  const growthLevel = idea.growthLevel ?? computeGrowthLevel(idea.growthPoints ?? 0);
                  return (
                    <motion.div
                      key={idea.id}
                      id={`idea-card-${idea.id}`}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className={`group relative border rounded-md p-4 transition-colors cursor-pointer ${
                        isHighlighted
                          ? 'border-green-500/50 bg-green-500/5'
                          : 'border-border hover:bg-accent/50'
                      }`}
                      onClick={() =>
                        isGlobalSearch
                          ? handleGlobalCardClick(idea.id!, idea.projectId)
                          : handleCardClick(idea.id!)
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1 min-w-0">
                          <span
                            className="shrink-0 text-sm leading-none"
                            title={`成长阶段：Lv.${growthLevel}`}
                          >
                            {growthEmoji(growthLevel)}
                          </span>
                          <h3 className="text-sm font-medium leading-tight line-clamp-1">
                            {idea.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <RarityBadge level={rarity.level} compact />
                          <div className={`flex items-center gap-1 ${idea.isFavorite ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                            <button
                              className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                              onClick={(e) => { e.stopPropagation(); openCard(idea.id!); }}
                              title="生成灵感卡片"
                            >
                              <ImageIcon className="size-3.5" strokeWidth={1.5} />
                            </button>
                            <button
                              className={`p-1 rounded hover:bg-accent transition-colors ${idea.isFavorite ? 'opacity-100' : ''}`}
                              onClick={(e) => toggleFavorite(e, idea.id!, !!idea.isFavorite)}
                              title={idea.isFavorite ? '取消收藏' : '收藏'}
                            >
                              <Star
                                className={`size-3.5 ${idea.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                                strokeWidth={1.5}
                              />
                            </button>
                            <CopyButton prompt={idea.prompt} ideaId={idea.id!} />
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1.5">
                        {idea.prompt}
                      </p>
                      {/* 全局搜索：显示来源信息 */}
                      {isGlobalSearch && (
                        <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                          <Globe className="size-3" strokeWidth={1.5} />
                          <span>{idea.categoryName} / {idea.projectName}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {idea.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {idea.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[10px]">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                          {new Date(idea.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </motion.div>
                  );
                })
              )}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </motion.div>
        )}
        </AnimatePresence>
      </>
    );
  }
);

function EmptyState({ isGlobal, hasQuery, onNew }: { isGlobal: boolean; hasQuery: boolean; onNew: () => void }) {
  if (isGlobal && !hasQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-3">
          <Globe className="size-8 text-muted-foreground/50" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">输入关键词搜索所有项目的灵感</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-3">
        <Sparkles className="size-8 text-muted-foreground/50" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">
          {isGlobal ? '未找到匹配的灵感' : '暂无灵感'}
        </p>
        {!isGlobal && (
          <Button variant="outline" size="sm" onClick={onNew}>
            <Plus strokeWidth={1.5} className="mr-1" />
            新建
          </Button>
        )}
      </div>
    </div>
  );
}
