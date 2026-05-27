import {
  BarChart3,
  Bell,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
  AlertCircle,
  TrendingUp,
  ClipboardList,
  Mail,
  UserCircle,
  ChevronDown,
  UserRound,
  UserPlus,
  MessageSquare,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { userApi } from "../api/user";
import { messageApi } from "../api/messages";
import { plannerApi } from "../api/planners";

const baseLinks = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/policies", label: "Policies", icon: FileText },
  { to: "/analytics/cross", label: "Cross Analytics", icon: BarChart3 },
];

const plannerLinks = [
  { to: "/associates/invitations", label: "Invitations", icon: Mail },
];

const adminLinks = [
  { to: "/planners", label: "Planners", icon: Users },
  { to: "/citizens", label: "Citizens", icon: UserRound },
  { to: "/planner-requests", label: "Planner Requests", icon: UserPlus },
  { to: "/comments/pending", label: "Pending Comments", icon: MessageSquare },
  { to: "/trends", label: "Trends", icon: TrendingUp },
  { to: "/audit-logs", label: "Audit Logs", icon: ClipboardList },
];

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [pendingInvitationsCount, setPendingInvitationsCount] = useState(0);

  let links = [...baseLinks];
  if (role === "planner") links = [...links, ...plannerLinks];
  if (role === "admin") links = [...links, ...adminLinks];

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const notifRes = await userApi.getNotifications({
          unreadOnly: true,
          limit: 1,
        });
        setUnreadNotifications(notifRes.total || 0);
        const msgRes = await messageApi.getInbox({
          unreadOnly: true,
          limit: 1,
        });
        setUnreadMessages(msgRes.total || 0);
        if (role === "planner") {
          const invitationsRes = await plannerApi.getPendingInvitations();
          setPendingInvitationsCount(invitationsRes.data?.length || 0);
        }
      } catch (err) {
        console.error("Failed to fetch counts", err);
      }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [role]);

  const isActive = (to) => {
    if (to === "/planners") {
      return (
        location.pathname === "/planners" ||
        location.pathname.startsWith("/planners/")
      );
    }
    return location.pathname === to;
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      {/* Mobile overlay */}
      <div className="lg:hidden">
        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-slate-950/40"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal-700 text-sm font-black text-white">
              CP
            </span>
            <div>
              <p className="m-0 text-sm font-bold text-slate-950">
                Civic Platform
              </p>
              <span className="mt-1 inline-block rounded-full bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-700">
                {role === "admin" ? "Admin" : "Planner"}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {links.map((link) => {
            const Icon = link.icon;
            const showBadge =
              link.to === "/associates/invitations" &&
              pendingInvitationsCount > 0;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive: navLinkActive }) => {
                  const active =
                    link.to === "/planners" ? isActive(link.to) : navLinkActive;
                  return `flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                    active && link.label !== "Analytics"
                      ? "bg-teal-700 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                  }`;
                }}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {link.label}
                </div>
                {showBadge && (
                  <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                    {pendingInvitationsCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* <div className="border-t border-slate-200 p-4">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="truncate text-sm font-semibold text-slate-950">
              {user?.email || "Dashboard user"}
            </p>
          </div>
        </div> */}
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Welcome back
              </p>
              <h1 className="text-base font-bold text-slate-950 sm:text-lg">
                {user?.email || "Dashboard user"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Messages */}
            <button
              onClick={() => navigate("/messages")}
              className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              title="Messages"
            >
              <Inbox className="h-5 w-5" />
              {unreadMessages > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </button>

            {/* Notifications */}
            <button
              onClick={() => navigate("/notifications")}
              className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </button>

            {/* User dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <UserCircle className="h-5 w-5" />
                <ChevronDown className="h-4 w-4" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        navigate("/settings");
                        setUserMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>
                    <hr className="my-1 border-slate-200" />
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-rose-700 hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
