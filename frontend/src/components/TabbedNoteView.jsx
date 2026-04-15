import { useState, useMemo, useEffect } from 'react';
import NoteEditor from './NoteEditor';
import { ChevronRight } from 'lucide-react';

/**
 * TabbedNoteView — Renders TipTap JSON content as tabs/sub-tabs/sub-sub-tabs
 *
 * H1 headings → main tabs
 * H2 headings → sub-tabs within each main tab
 * H3 headings → sub-sub-tabs within each sub-tab
 * Content between headings → tab content
 */
function TabbedNoteView({ content, onTabChange }) {
  const [activeTab, setActiveTab] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState(0);
  const [activeSubSubTab, setActiveSubSubTab] = useState(0);

  // Parse content into 3-level tab structure
  const tabs = useMemo(() => {
    if (!content || !content.content) return [];

    const nodes = content.content;
    const result = [];
    let currentTab = null;
    let currentSubTab = null;
    let currentSubSubTab = null;
    let introNodes = [];

    const flushSubSubTab = () => {
      if (currentSubSubTab && currentSubTab) {
        currentSubTab.subTabs.push(currentSubSubTab);
        currentSubSubTab = null;
      }
    };

    const flushSubTab = () => {
      flushSubSubTab();
      if (currentSubTab && currentTab) {
        currentTab.subTabs.push(currentSubTab);
        currentSubTab = null;
      }
    };

    for (const node of nodes) {
      const isH1 = node.type === 'heading' && node.attrs?.level === 1;
      const isH2 = node.type === 'heading' && node.attrs?.level === 2;
      const isH3 = node.type === 'heading' && node.attrs?.level === 3;

      if (isH1) {
        flushSubTab();
        if (currentTab) result.push(currentTab);
        currentTab = { title: extractText(node), subTabs: [], directContent: [] };
      } else if (isH2 && currentTab) {
        flushSubTab();
        currentSubTab = { title: extractText(node), subTabs: [], directContent: [] };
      } else if (isH3 && currentSubTab) {
        flushSubSubTab();
        currentSubSubTab = { title: extractText(node), content: [] };
      } else if (currentSubSubTab) {
        currentSubSubTab.content.push(node);
      } else if (currentSubTab) {
        currentSubTab.directContent.push(node);
      } else if (currentTab) {
        currentTab.directContent.push(node);
      } else {
        introNodes.push(node);
      }
    }

    // Flush remaining
    flushSubSubTab();
    flushSubTab();
    if (currentTab) result.push(currentTab);

    if (introNodes.length > 0 && result.length > 0) {
      result.unshift({ title: 'Resumen', subTabs: [], directContent: introNodes });
    }

    return result;
  }, [content]);

  // Not enough structure for tabs — fall back to normal view
  if (tabs.length < 2) {
    return (
      <NoteEditor
        content={content}
        onChange={() => {}}
        placeholder=""
        minHeight="200px"
        readOnly
      />
    );
  }

  const currentTab = tabs[activeTab] || tabs[0];
  const hasSubTabs = currentTab?.subTabs?.length > 0;
  const currentSubTabData = hasSubTabs
    ? (activeSubTab === -1 ? null : currentTab.subTabs[activeSubTab] || currentTab.subTabs[0])
    : null;
  const hasSubSubTabs = currentSubTabData?.subTabs?.length > 0;
  const currentSubSubTabData = hasSubSubTabs
    ? (activeSubSubTab === -1 ? null : currentSubTabData.subTabs[activeSubSubTab] || currentSubTabData.subTabs[0])
    : null;

  // Notify parent of tab context changes
  useEffect(() => {
    if (!onTabChange) return;
    const parts = [currentTab?.title];
    if (currentSubTabData) parts.push(currentSubTabData.title);
    if (currentSubSubTabData) parts.push(currentSubSubTabData.title);
    onTabChange(parts.filter(Boolean).join(' > '));
  }, [activeTab, activeSubTab, activeSubSubTab, currentTab, currentSubTabData, currentSubSubTabData, onTabChange]);

  // Build content for active selection
  const activeContent = useMemo(() => {
    let nodes = [];

    if (activeSubTab === -1) {
      // Showing tab's direct content (General)
      nodes = currentTab?.directContent || [];
    } else if (hasSubSubTabs && activeSubSubTab === -1) {
      // Showing sub-tab's direct content (General)
      nodes = currentSubTabData?.directContent || [];
    } else if (currentSubSubTabData) {
      // Showing sub-sub-tab content
      nodes = currentSubSubTabData.content || [];
    } else if (currentSubTabData && !hasSubSubTabs) {
      // Sub-tab with no sub-sub-tabs: show all its direct content
      nodes = currentSubTabData.directContent || [];
    } else if (!hasSubTabs) {
      // Tab with no sub-tabs: show direct content
      nodes = currentTab?.directContent || [];
    }

    return { type: 'doc', content: nodes.length > 0 ? nodes : [{ type: 'paragraph' }] };
  }, [activeTab, activeSubTab, activeSubSubTab, currentTab, currentSubTabData, currentSubSubTabData, hasSubTabs, hasSubSubTabs]);

  return (
    <div>
      {/* Main tabs (H1) */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4 border-b border-slate-200 scrollbar-thin">
        {tabs.map((tab, idx) => (
          <button
            key={idx}
            onClick={() => { setActiveTab(idx); setActiveSubTab(0); setActiveSubSubTab(0); }}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors flex-shrink-0 ${
              activeTab === idx
                ? 'bg-white text-[#1A1A2E] border border-slate-200 border-b-white -mb-px'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.title}
          </button>
        ))}
      </div>

      {/* Sub-tabs (H2) */}
      {hasSubTabs && (
        <div className="flex gap-1 overflow-x-auto pb-1 mb-3 scrollbar-thin">
          {currentTab.directContent.length > 0 && (
            <button
              onClick={() => { setActiveSubTab(-1); setActiveSubSubTab(0); }}
              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded-full transition-colors flex-shrink-0 ${
                activeSubTab === -1
                  ? 'bg-[#1A1A2E] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              General
            </button>
          )}
          {currentTab.subTabs.map((sub, idx) => (
            <button
              key={idx}
              onClick={() => { setActiveSubTab(idx); setActiveSubSubTab(0); }}
              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded-full transition-colors flex-shrink-0 ${
                activeSubTab === idx
                  ? 'bg-[#1A1A2E] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {sub.title}
            </button>
          ))}
        </div>
      )}

      {/* Sub-sub-tabs (H3) */}
      {hasSubSubTabs && (
        <div className="flex gap-1 overflow-x-auto pb-1 mb-3 ml-2 scrollbar-thin">
          {currentSubTabData.directContent.length > 0 && (
            <button
              onClick={() => setActiveSubSubTab(-1)}
              className={`px-2.5 py-1 text-[11px] font-medium whitespace-nowrap rounded-full transition-colors flex-shrink-0 border ${
                activeSubSubTab === -1
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              General
            </button>
          )}
          {currentSubTabData.subTabs.map((sub, idx) => (
            <button
              key={idx}
              onClick={() => setActiveSubSubTab(idx)}
              className={`px-2.5 py-1 text-[11px] font-medium whitespace-nowrap rounded-full transition-colors flex-shrink-0 border ${
                activeSubSubTab === idx
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              {sub.title}
            </button>
          ))}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs text-slate-400 mb-3">
        <span>{currentTab?.title}</span>
        {currentSubTabData && (
          <>
            <ChevronRight size={12} />
            <span>{currentSubTabData.title}</span>
          </>
        )}
        {currentSubSubTabData && (
          <>
            <ChevronRight size={12} />
            <span>{currentSubSubTabData.title}</span>
          </>
        )}
      </div>

      {/* Content */}
      <div className="prose prose-slate max-w-none">
        <NoteEditor
          key={`${activeTab}-${activeSubTab}-${activeSubSubTab}`}
          content={activeContent}
          onChange={() => {}}
          placeholder=""
          minHeight="100px"
          readOnly
        />
      </div>
    </div>
  );
}

/**
 * Extract plain text from a TipTap node
 */
function extractText(node) {
  if (!node) return '';
  if (node.text) return node.text;
  if (node.content) return node.content.map(extractText).join('');
  return '';
}

export default TabbedNoteView;
