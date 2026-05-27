import { useState } from "react";

export function Tabs({ tabs, defaultTab, children }) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  const activeContent = children.find(
    (child) => child.props.tabId === activeTab,
  );
  return (
    <div>
      <div className="border-b border-slate-200">
        <nav className="flex space-x-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-t-lg px-4 py-2 text-sm font-bold ${
                activeTab === tab.id
                  ? "border-b-2 border-teal-700 text-teal-700"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-5">{activeContent}</div>
    </div>
  );
}

export function TabPane({ tabId, children }) {
  return <div>{children}</div>;
}
