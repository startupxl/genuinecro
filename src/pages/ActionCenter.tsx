import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { getActiveActionItems, updateActionItemStatus, type ActionItem } from "@/lib/firebase/actionItems";

const severityBorderClass: Record<string, string> = {
  high: "border-l-4 border-l-friction-high",
  med: "border-l-4 border-l-friction-med",
  low: "border-l-4 border-l-friction-low",
};

const statusOptions: { value: ActionItem["status"]; label: string }[] = [
  { value: "open", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Done" },
];

const ActionCenter = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    getActiveActionItems(user.uid).then((records) => {
      setItems(records);
      setLoading(false);
    });
  }, [user]);

  const handleStatusChange = async (id: string, status: ActionItem["status"]) => {
    await updateActionItemStatus(id, status);
    if (status === "resolved") {
      setItems((prev) => prev.filter((item) => item.id !== id));
    } else {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
    }
  };

  if (!user) {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-muted-foreground">Please sign in to view your action center.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6">
      <h1 className="text-xl font-semibold text-foreground font-display mb-6">Action Center</h1>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading open issues…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No open issues — you're all caught up.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div
              key={item.id}
              className={`bg-surface p-4 shadow-card rounded-lg ${severityBorderClass[item.severity]}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.url.replace(/^https?:\/\//, "")}</span>
                <div className="flex items-center gap-1">
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      aria-pressed={item.status === option.value}
                      onClick={() => handleStatusChange(item.id, option.value)}
                      className={`text-[11px] px-2 py-1 rounded transition-colors ${
                        item.status === option.value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      )}
      </div>
    </AppShell>
  );
};

export default ActionCenter;
