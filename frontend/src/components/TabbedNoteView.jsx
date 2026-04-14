import { useState, useMemo } from 'react';
import NoteEditor from './NoteEditor';
import { ChevronRight } from 'lucide-react';

/**
 * TabbedNoteView — Renders TipTap JSON content as tabs/sub-tabs
 *
 * H1 headings → main tabs
 * H2 headings → sub-tabs within each main tab
 * Content between headings → tab content
 */
function TabbedNoteView({ content }) {
  const [activeTab, setActiveTab] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState(0);

  // Parse content into tab structure
  const tabs = useMemo(() => {
    if (!content || !content.content) return [];

    const nodes = content.content;
    const result = [];
    let currentTab = null;
    let currentSubTab = null;
    let introNodes = []; // Nodes before first H1

    for (const node of nodes) {
      const isH1 = node.type === 'heading' && node.attrs?.level === 1;
      const isH2 = node.type === 'heading' && node.attrs?.level === 2;

      if (isH1) {
        // Save previous sub-tab
        if (currentSubTab && currentTab) {
          currentTab.subTabs.push(currentSubTab);
        }
        // Save previous tab
        if (currentTab) {
          result.push(currentTab);
        }
        // Start new tab
        const title = extractText(node);
        currentTab = { title, subTabs: [], directContent: [] };
        currentSubTab = null;
      } else if (isH2 && currentTab) {
        // Save previous sub-tab content
        if (currentSubTab) {
          currentTab.subTabs.push(currentSubTab);
        }
        const title = extractText(node);
        currentSubTab = { title, content: [] };
      } else if (currentSubTab) {
        currentSubTab.content.push(node);
      } else if (currentTab) {
        currentTab.directContent.push(node);
      } else {
        introNodes.push(node);
      }
    }

    // Flush last sub-tab and tab
    if (currentSubTab && currentTab) {
      currentTab.subTabs.push(currentSubTab);
    }
    if (currentTab) {
      result.push(currentTab);
    }

    // If there are intro nodes, add them as a first "Resumen" tab
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
  const currentSubTabData = hasSubTabs ? currentTab.subTabs[activeSubTab] || currentTab.subTabs[0] : null;

  // Build TipTap JSON for the active content
  const activeContent = useMemo(() => {
    const nodes = [];

    if (currentTab?.directContent?.length > 0) {
      nodes.push(...currentTab.directContent);
    }

    if (currentSubTabData) {
      nodes.push(...currentSubTabData.content);
    } else if (!hasSubTabs && currentTab?.directContent) {
      // Already added above
    }

    // If showing all direct content + no sub-tab selected, show everything
    if (hasSubTabs && !currentSubTabData && currentTab?.directContent) {
      // Show just direct content
    }

    return { type: 'doc', content: nodes.length > 0 ? nodes : [{ type: 'paragraph' }] };
  }, [currentTab, currentSubTabData, hasSubTabs]);

  return (
    <div>
      {/* Main tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4 border-b border-slate-200 scrollbar-thin">
        {tabs.map((tab, idx) => (
          <button
            key={idx}
            onClick={() => { setActiveTab(idx); setActiveSubTab(0); }}
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

      {/* Sub-tabs */}
      {hasSubTabs && (
        <div className="flex gap-1 overflow-x-auto pb-1 mb-4 scrollbar-thin">
          {/* "General" sub-tab for direct content */}
          {currentTab.directContent.length > 0 && (
            <button
              onClick={() => setActiveSubTab(-1)}
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
              onClick={() => setActiveSubTab(idx)}
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

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs text-slate-400 mb-3">
        <span>{currentTab?.title}</span>
        {hasSubTabs && activeSubTab >= 0 && currentSubTabData && (
          <>
            <ChevronRight size={12} />
            <span>{currentSubTabData.title}</span>
          </>
        )}
      </div>

      {/* Content */}
      <div className="prose prose-slate max-w-none">
        {activeSubTab === -1 && currentTab?.directContent?.length > 0 ? (
          <NoteEditor
            key={`${activeTab}-general`}
            content={{ type: 'doc', content: currentTab.directContent }}
            onChange={() => {}}
            placeholder=""
            minHeight="100px"
            readOnly
          />
        ) : (
          <NoteEditor
            key={`${activeTab}-${activeSubTab}`}
            content={activeContent}
            onChange={() => {}}
            placeholder=""
            minHeight="100px"
            readOnly
          />
        )}
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
