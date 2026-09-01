export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Shown in the command palette and global search. */
  keywords?: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "Command Center",
    items: [{ href: "/life", label: "Dashboard", icon: "Home", keywords: ["home", "today", "overview", "momentum"] }],
  },
  {
    label: "Daily",
    items: [
      { href: "/life/morning", label: "Morning", icon: "Sunrise", keywords: ["routine", "wake", "protected"] },
      { href: "/life/tasks", label: "Tasks", icon: "ListChecks", keywords: ["priorities", "two", "todo"] },
      { href: "/life/journal", label: "Journal", icon: "PenLine", keywords: ["brain dump", "gratitude", "clear"] },
      { href: "/life/learning", label: "Learning", icon: "BookOpen", keywords: ["read", "book", "nugget", "pages"] },
      { href: "/life/night", label: "Night", icon: "MoonStar", keywords: ["debrief", "bedtime", "wind down", "tomorrow"] },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/life/habits", label: "Habits", icon: "Layers", keywords: ["eight", "streak", "completion"] },
      { href: "/life/momentum", label: "Momentum", icon: "Activity", keywords: ["score", "streak", "recovery"] },
      { href: "/life/north-star", label: "North Star", icon: "Target", keywords: ["metric", "revenue", "goal"] },
      { href: "/life/choose-hard", label: "Choose Hard", icon: "Mountain", keywords: ["challenge", "milestone", "climb"] },
    ],
  },
  {
    label: "Environment",
    items: [
      { href: "/life/people", label: "People", icon: "Users", keywords: ["relationships", "standards", "drains"] },
      { href: "/life/places", label: "Places", icon: "MapPin", keywords: ["workspace", "gym", "digital", "phone"] },
      { href: "/life/environment", label: "Environment", icon: "Boxes", keywords: ["easy", "hard", "design", "friction"] },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/life/weekly", label: "Weekly", icon: "BarChart3", keywords: ["week", "report", "best day"] },
      { href: "/life/monthly", label: "Monthly", icon: "CalendarDays", keywords: ["month", "report", "1% better"] },
      { href: "/life/progress", label: "Progress", icon: "LineChart", keywords: ["history", "heatmap", "all time"] },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/life/alarms", label: "Alarms", icon: "AlarmClock", keywords: ["wake", "bedtime", "notifications", "test"] },
      { href: "/life/settings", label: "Settings", icon: "Settings", keywords: ["theme", "accent", "export", "import", "backup", "reset"] },
    ],
  },
];

export const NAV_FLAT: NavItem[] = NAV.flatMap((g) => g.items);
