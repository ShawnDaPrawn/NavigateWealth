/**
 * Application components: the complex, stateful patterns of the kit (app
 * navigation, tabs, tables, pagination, overlays, date pickers, uploads,
 * loading and empty states, carousels and charts), each shown with Navigate
 * Wealth sample content.
 *
 * App navigation is `fixed`/`sticky` and full height by design, so every
 * navigation example sits in a contained frame whose `transform` makes it the
 * containing block for those fixed elements.
 */
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { DateValue } from "@internationalized/date";
import { getLocalTimeZone, today } from "@internationalized/date";
import type { FileIcon } from "@untitledui/file-icons";
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    BarChartSquare02,
    Bell01,
    BookOpen01,
    Briefcase01,
    CheckCircle,
    ClipboardCheck,
    CoinsStacked01,
    DownloadCloud02,
    Edit01,
    FileCheck02,
    FileShield02,
    FilterLines,
    HomeLine,
    Inbox01,
    LifeBuoy01,
    LineChartUp03,
    Mail01,
    MessageChatCircle,
    PieChart03,
    Plus,
    SearchLg,
    Settings01,
    ShieldTick,
    Stars02,
    Target04,
    Trash01,
    UserPlus01,
    Users01,
    Wallet02,
} from "@untitledui/icons";
import { UNSAFE_PortalProvider } from "react-aria";
import type { SortDescriptor } from "react-aria-components";
import { Heading as AriaHeading, RangeCalendarContext } from "react-aria-components";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    XAxis,
    YAxis,
} from "recharts";
import { MobileNavigationHeader } from "@/components/application/app-navigation/base-components/mobile-header";
import { NavAccountCard, NavAccountMenu, type NavAccountType } from "@/components/application/app-navigation/base-components/nav-account-card";
import { NavButton } from "@/components/application/app-navigation/base-components/nav-button";
import { NavItemBase } from "@/components/application/app-navigation/base-components/nav-item";
import { NavList } from "@/components/application/app-navigation/base-components/nav-list";
import type { NavItemDividerType, NavItemType } from "@/components/application/app-navigation/config";
import { HeaderNavigationBase } from "@/components/application/app-navigation/header-navigation";
import { SidebarNavigationDualTier } from "@/components/application/app-navigation/sidebar-navigation/sidebar-dual-tier";
import { SidebarNavigationSectionDividers } from "@/components/application/app-navigation/sidebar-navigation/sidebar-section-dividers";
import { SidebarNavigationSectionsSubheadings } from "@/components/application/app-navigation/sidebar-navigation/sidebar-sections-subheadings";
import { SidebarNavigationSimple } from "@/components/application/app-navigation/sidebar-navigation/sidebar-simple";
import { SidebarNavigationSlim } from "@/components/application/app-navigation/sidebar-navigation/sidebar-slim";
import { Carousel, useCarousel } from "@/components/application/carousel/carousel-base";
import { ChartActiveDot, ChartLegendContent, ChartTooltipContent, selectEvenlySpacedItems } from "@/components/application/charts/charts-base";
import { Calendar } from "@/components/application/date-picker/calendar";
import { DatePicker } from "@/components/application/date-picker/date-picker";
import { DateRangePicker } from "@/components/application/date-picker/date-range-picker";
import { RangeCalendar, RangePresetButton } from "@/components/application/date-picker/range-calendar";
import { EmptyState } from "@/components/application/empty-state/empty-state";
import { FileUpload } from "@/components/application/file-upload/file-upload-base";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Dialog, DialogTrigger, Modal, ModalOverlay } from "@/components/application/modals/modal";
import {
    PaginationButtonGroup,
    PaginationCardAdvanced,
    PaginationCardDefault,
    PaginationCardMinimal,
    PaginationPageDefault,
    PaginationPageMinimalCenter,
} from "@/components/application/pagination/pagination";
import { Pagination } from "@/components/application/pagination/pagination-base";
import { PaginationDot } from "@/components/application/pagination/pagination-dot";
import { PaginationLine } from "@/components/application/pagination/pagination-line";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { Table, TableCard, TableRowActionsDropdown } from "@/components/application/table/table";
import { Tab, TabList, TabPanel, Tabs } from "@/components/application/tabs/tabs";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { cx } from "@/utils/cx";
import { Caption, Demo, Labelled, ShowcaseSection } from "../showcase-kit";
import type { ShowcaseGroup } from "../showcase-kit";

/* ------------------------------------------------------------------------------------------------
 * Shared sample data
 * --------------------------------------------------------------------------------------------- */

/** An avatar image drawn from initials, as a data URI, so no external images are loaded. */
const initialsAvatar = (initials: string, background = "#6d28d9") =>
    `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="${background}"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="system-ui, sans-serif" font-size="30" font-weight="600" fill="#ffffff">${initials}</text></svg>`,
    )}`;

const AVATAR_COLOURS = ["#6d28d9", "#313653", "#0e7490", "#15803d", "#b45309", "#be185d", "#4338ca", "#475569", "#7c3aed"];

const TEAM = [
    ["TM", "Thandi Mokoena"],
    ["JvdB", "Johan van der Berg"],
    ["AN", "Ayesha Naidoo"],
    ["SD", "Sipho Dlamini"],
    ["LB", "Lerato Botha"],
    ["RP", "Riaan Pretorius"],
    ["NK", "Nomsa Khumalo"],
    ["DG", "David Govender"],
    ["ZM", "Zanele Mahlangu"],
] as const;

const teamAvatars = TEAM.map(([initials, name], i) => ({ src: initialsAvatar(initials, AVATAR_COLOURS[i % AVATAR_COLOURS.length]), alt: name }));

const ACCOUNTS: NavAccountType[] = [
    { id: "adviser", name: "Thandi Mokoena", email: "thandi@navigatewealth.example", avatar: initialsAvatar("TM"), status: "online" },
    { id: "paraplanner", name: "Johan van der Berg", email: "johan@navigatewealth.example", avatar: initialsAvatar("JvdB", "#313653"), status: "offline" },
];

/** Hash links keep every navigation example on this page when clicked. */
const NAV_ITEMS: NavItemType[] = [
    { label: "Dashboard", href: "#/dashboard", icon: HomeLine },
    {
        label: "Clients",
        href: "#/clients",
        icon: Users01,
        badge: 128,
        items: [
            { label: "All clients", href: "#/clients/all", icon: Users01 },
            { label: "Households", href: "#/clients/households", icon: HomeLine },
            { label: "Onboarding", href: "#/clients/onboarding", icon: UserPlus01, badge: 3 },
        ],
    },
    {
        label: "Portfolios",
        href: "#/portfolios",
        icon: PieChart03,
        items: [
            { label: "Model portfolios", href: "#/portfolios/models", icon: Briefcase01 },
            { label: "Rebalancing", href: "#/portfolios/rebalancing", icon: Target04 },
            { label: "Performance", href: "#/portfolios/performance", icon: LineChartUp03 },
        ],
    },
    {
        label: "Compliance",
        href: "#/compliance",
        icon: ShieldTick,
        badge: 5,
        items: [
            { label: "FICA checks", href: "#/compliance/fica", icon: FileShield02 },
            { label: "Record of advice", href: "#/compliance/roa", icon: FileCheck02 },
        ],
    },
    { label: "Reports", href: "#/reports", icon: BarChartSquare02 },
];

const FOOTER_ITEMS: NavItemType[] = [
    { label: "Support", href: "#/support", icon: LifeBuoy01 },
    { label: "Settings", href: "#/settings", icon: Settings01 },
];

const SLIM_ITEMS = NAV_ITEMS as (NavItemType & { icon: NonNullable<NavItemType["icon"]> })[];
const SLIM_FOOTER_ITEMS = FOOTER_ITEMS as (NavItemType & { icon: NonNullable<NavItemType["icon"]> })[];

const DIVIDED_ITEMS: (NavItemType | NavItemDividerType)[] = [
    { label: "Dashboard", href: "#/dashboard", icon: HomeLine },
    { label: "Clients", href: "#/clients", icon: Users01, badge: 128 },
    { label: "Portfolios", href: "#/portfolios", icon: PieChart03 },
    { divider: true },
    { label: "Compliance", href: "#/compliance", icon: ShieldTick, badge: 5 },
    { label: "Reports", href: "#/reports", icon: BarChartSquare02 },
    { divider: true },
    { label: "Support", href: "#/support", icon: LifeBuoy01 },
    { label: "Settings", href: "#/settings", icon: Settings01 },
];

const SUBHEADING_ITEMS: Array<{ label: string; items: NavItemType[] }> = [
    {
        label: "Practice",
        items: [
            { label: "Dashboard", href: "#/dashboard", icon: HomeLine },
            { label: "Clients", href: "#/clients", icon: Users01, badge: 128 },
            { label: "Portfolios", href: "#/portfolios", icon: PieChart03 },
        ],
    },
    {
        label: "Governance",
        items: [
            { label: "Compliance", href: "#/compliance", icon: ShieldTick, badge: 5 },
            { label: "Reports", href: "#/reports", icon: BarChartSquare02 },
        ],
    },
    {
        label: "Workspace",
        items: [
            { label: "Inbox", href: "#/inbox", icon: Inbox01, badge: 8 },
            { label: "Settings", href: "#/settings", icon: Settings01 },
        ],
    },
];

const formatRand = (value: number) => `R ${Math.round(value).toLocaleString("en-ZA").replace(/,/g, " ")}`;

/* ------------------------------------------------------------------------------------------------
 * Navigation frames
 * --------------------------------------------------------------------------------------------- */

/** A stand-in page so each navigation example reads as a real screen. */
const FramePage = ({ title = "Clients" }: { title?: string }) => (
    <main className="bg-secondary_subtle min-w-0 flex-1 overflow-auto p-6 lg:p-8">
        <p className="text-sm font-semibold text-brand-secondary">Navigate Wealth</p>
        <h4 className="mt-1 text-display-xs font-semibold text-primary">{title}</h4>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
                ["Assets under advice", "R 1 250 000 000"],
                ["Active clients", "128"],
                ["Reviews due", "12"],
            ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary">
                    <p className="text-sm text-tertiary">{label}</p>
                    <p className="mt-2 text-display-xs font-semibold text-primary">{value}</p>
                </div>
            ))}
        </div>
        <div className="mt-4 h-72 rounded-xl bg-primary shadow-xs ring-1 ring-secondary" />
    </main>
);

/**
 * Contains fixed and sticky navigation. `transform` makes this frame the
 * containing block for `position: fixed` descendants, so they stay inside.
 */
const NavFrame = ({ children, height = "h-[720px]", page = true }: { children: ReactNode; height?: string; page?: boolean }) => (
    <div className={cx("relative flex w-full [transform:translateZ(0)] flex-col overflow-hidden bg-primary lg:flex-row", height)}>
        {children}
        {page && <FramePage />}
    </div>
);

const FeatureCard = () => (
    <div className="rounded-xl bg-secondary p-4">
        <p className="text-sm font-semibold text-primary">Annual reviews</p>
        <p className="mt-1 text-sm text-tertiary">12 client reviews are due before the end of the tax year.</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-quaternary">
            <div className="h-full w-2/3 rounded-full bg-fg-brand-primary" />
        </div>
        <div className="mt-3 flex gap-3">
            <Button size="sm" color="link-gray">
                Dismiss
            </Button>
            <Button size="sm" color="link-color">
                View reviews
            </Button>
        </div>
    </div>
);

/* ------------------------------------------------------------------------------------------------
 * Sidebar navigation sections
 * --------------------------------------------------------------------------------------------- */

const SidebarSimpleSection = () => (
    <ShowcaseSection
        id="app-sidebar-simple"
        title="Sidebar navigation: simple"
        description="The standard sidebar: logo, search, a nav list with collapsible groups and badges, footer links, an optional feature card and the account card. Below 1024px it collapses into the mobile header."
        importPath="application/app-navigation/sidebar-navigation/sidebar-simple"
        exports={["SidebarNavigationSimple"]}
    >
        <Demo title="With footer items and feature card (active: Clients > All clients)" className="block p-0">
            <NavFrame>
                <SidebarNavigationSimple activeUrl="#/clients/all" items={NAV_ITEMS} footerItems={FOOTER_ITEMS} featureCard={<FeatureCard />} />
            </NavFrame>
        </Demo>
        <Demo title="Without account card, border hidden (active: Reports)" className="block p-0">
            <NavFrame height="h-[600px]">
                <SidebarNavigationSimple activeUrl="#/reports" items={NAV_ITEMS} showAccountCard={false} hideBorder />
            </NavFrame>
        </Demo>
        <Caption>
            The account card inside the kit's sidebars uses the kit's own placeholder accounts; pass your own via the dual-tier sidebar or NavAccountCard.
        </Caption>
    </ShowcaseSection>
);

const SidebarSlimSection = () => (
    <ShowcaseSection
        id="app-sidebar-slim"
        title="Sidebar navigation: slim"
        description="An icon rail with tooltips. Hover the rail to slide out the second tier for the current item; the avatar opens the account menu."
        importPath="application/app-navigation/sidebar-navigation/sidebar-slim"
        exports={["SidebarNavigationSlim"]}
    >
        <Demo title="Slim rail (active: Portfolios > Rebalancing; hover to expand)" className="block p-0">
            <NavFrame>
                <SidebarNavigationSlim activeUrl="#/portfolios/rebalancing" items={SLIM_ITEMS} footerItems={SLIM_FOOTER_ITEMS} />
            </NavFrame>
        </Demo>
        <Demo title="Borderless" className="block p-0">
            <NavFrame height="h-[560px]">
                <SidebarNavigationSlim activeUrl="#/compliance/fica" items={SLIM_ITEMS} footerItems={SLIM_FOOTER_ITEMS} hideBorder hideRightBorder />
            </NavFrame>
        </Demo>
    </ShowcaseSection>
);

const SidebarDualTierSection = () => (
    <ShowcaseSection
        id="app-sidebar-dual-tier"
        title="Sidebar navigation: dual tier"
        description="A full sidebar whose items open a second column of sub-pages on hover. Accepts your own accounts for the account card."
        importPath="application/app-navigation/sidebar-navigation/sidebar-dual-tier"
        exports={["SidebarNavigationDualTier"]}
    >
        <Demo title="Dual tier with custom accounts (active: Clients > Onboarding; hover to expand)" className="block p-0">
            <NavFrame>
                <SidebarNavigationDualTier
                    activeUrl="#/clients/onboarding"
                    items={NAV_ITEMS}
                    footerItems={FOOTER_ITEMS}
                    accountItems={ACCOUNTS}
                    selectedAccountId="adviser"
                />
            </NavFrame>
        </Demo>
        <Demo title="With feature card, border hidden" className="block p-0">
            <NavFrame>
                <SidebarNavigationDualTier
                    activeUrl="#/portfolios/models"
                    items={NAV_ITEMS}
                    accountItems={ACCOUNTS}
                    selectedAccountId="paraplanner"
                    featureCard={<FeatureCard />}
                    hideBorder
                />
            </NavFrame>
        </Demo>
    </ShowcaseSection>
);

const SidebarSectionDividersSection = () => (
    <ShowcaseSection
        id="app-sidebar-section-dividers"
        title="Sidebar navigation: section dividers"
        description="A floating, inset sidebar whose item list is split into groups with divider rules."
        importPath="application/app-navigation/sidebar-navigation/sidebar-section-dividers"
        exports={["SidebarNavigationSectionDividers"]}
    >
        <Demo title="Section dividers (active: Compliance)" className="block p-0">
            <NavFrame>
                <SidebarNavigationSectionDividers activeUrl="#/compliance" items={DIVIDED_ITEMS} />
            </NavFrame>
        </Demo>
    </ShowcaseSection>
);

const SidebarSubheadingsSection = () => (
    <ShowcaseSection
        id="app-sidebar-subheadings"
        title="Sidebar navigation: sections with subheadings"
        description="A floating sidebar that groups items under uppercase subheadings, with a compact search button."
        importPath="application/app-navigation/sidebar-navigation/sidebar-sections-subheadings"
        exports={["SidebarNavigationSectionsSubheadings"]}
    >
        <Demo title="Sections with subheadings (active: Portfolios)" className="block p-0">
            <NavFrame>
                <SidebarNavigationSectionsSubheadings activeUrl="#/portfolios" items={SUBHEADING_ITEMS} />
            </NavFrame>
        </Demo>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------------------------------------
 * Header navigation
 * --------------------------------------------------------------------------------------------- */

const HEADER_ITEMS = [
    { label: "Dashboard", href: "#/dashboard" },
    {
        label: "Clients",
        href: "#/clients",
        items: [
            { label: "Overview", href: "#/clients/overview" },
            { label: "Households", href: "#/clients/households" },
            { label: "Onboarding", href: "#/clients/onboarding" },
            { label: "Annual reviews", href: "#/clients/reviews" },
        ],
    },
    {
        label: "Portfolios",
        href: "#/portfolios",
        items: [
            { label: "Model portfolios", href: "#/portfolios/models" },
            { label: "Rebalancing", href: "#/portfolios/rebalancing" },
            { label: "Performance", href: "#/portfolios/performance" },
        ],
    },
    { label: "Compliance", href: "#/compliance" },
    { label: "Reports", href: "#/reports" },
    { label: "Settings", href: "#/settings" },
];

const HeaderFrame = ({ children }: { children: ReactNode }) => (
    <div className="bg-secondary_subtle relative w-full [transform:translateZ(0)] overflow-hidden">
        {children}
        <div className="flex flex-col gap-3 p-6 lg:p-8">
            <div className="h-6 w-48 rounded-md bg-tertiary" />
            <div className="h-32 rounded-xl bg-primary shadow-xs ring-1 ring-secondary" />
        </div>
    </div>
);

const HeaderNavigationSection = () => (
    <ShowcaseSection
        id="app-header-navigation"
        title="Header navigation"
        description="A top bar of NavButtons with a secondary row for the active item's sub-pages (buttons or underline tabs), default actions (search, settings, notifications, account dropdown) or your own. Below 1024px it collapses into the mobile header."
        importPath="application/app-navigation/header-navigation"
        exports={["HeaderNavigationBase"]}
    >
        <Demo title="Secondary row as buttons, default actions (active: Clients > Overview)" className="block p-0">
            <HeaderFrame>
                <HeaderNavigationBase activeUrl="#/clients/overview" items={HEADER_ITEMS} />
            </HeaderFrame>
        </Demo>
        <Demo title='secondaryType="tabs" (active: Portfolios > Rebalancing)' className="block p-0">
            <HeaderFrame>
                <HeaderNavigationBase activeUrl="#/portfolios/rebalancing" items={HEADER_ITEMS} secondaryType="tabs" />
            </HeaderFrame>
        </Demo>
        <Demo title="Centred, custom actions (active: Reports)" className="block p-0">
            <HeaderFrame>
                <HeaderNavigationBase
                    centered
                    activeUrl="#/reports"
                    items={HEADER_ITEMS}
                    actions={
                        <>
                            <ButtonUtility color="tertiary" size="sm" icon={Bell01} tooltip="Notifications" />
                            <Button size="sm" iconLeading={UserPlus01}>
                                New client
                            </Button>
                            <Avatar size="sm" src={ACCOUNTS[0].avatar} alt={ACCOUNTS[0].name} />
                        </>
                    }
                />
            </HeaderFrame>
        </Demo>
        <Demo title="No sub-items, border hidden (active: Dashboard)" className="block p-0">
            <HeaderFrame>
                <HeaderNavigationBase hideBorder activeUrl="#/dashboard" items={HEADER_ITEMS} />
            </HeaderFrame>
        </Demo>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------------------------------------
 * Navigation base components
 * --------------------------------------------------------------------------------------------- */

/**
 * The mobile header is `lg:hidden` and opens a full-height overlay. Here it is
 * forced visible at every width and its overlay is portalled into the frame.
 */
const MobileHeaderDemo = () => {
    const [container, setContainer] = useState<HTMLDivElement | null>(null);

    return (
        <div
            ref={setContainer}
            className="relative flex h-[640px] w-full max-w-[390px] [transform:translateZ(0)] flex-col overflow-hidden rounded-xl bg-primary ring-1 ring-secondary [&_[role=dialog]]:h-[640px]! [&>div]:block! [&>header]:flex!"
        >
            <UNSAFE_PortalProvider getContainer={() => container}>
                <MobileNavigationHeader>
                    <aside className="flex h-full flex-col justify-between overflow-auto bg-primary pt-4">
                        <div className="px-4">
                            <p className="text-lg font-semibold text-primary">Navigate Wealth</p>
                        </div>
                        <NavList activeUrl="#/clients/all" items={NAV_ITEMS} />
                        <div className="mt-auto flex flex-col gap-3 p-4">
                            <div className="flex flex-col">
                                {FOOTER_ITEMS.map((item) => (
                                    <NavItemBase key={item.label} type="link" href={item.href} icon={item.icon}>
                                        {item.label}
                                    </NavItemBase>
                                ))}
                            </div>
                            <NavAccountCard items={ACCOUNTS} selectedAccountId="adviser" popoverPlacement="top" />
                        </div>
                    </aside>
                </MobileNavigationHeader>
            </UNSAFE_PortalProvider>
            <section className="bg-secondary_subtle flex-1 p-4">
                <p className="text-lg font-semibold text-primary">Clients</p>
                <p className="text-sm text-tertiary">Tap the menu button to open the navigation drawer.</p>
                <div className="mt-4 h-40 rounded-xl bg-primary ring-1 ring-secondary" />
            </section>
        </div>
    );
};

const NavBaseComponentsSection = () => (
    <ShowcaseSection
        id="app-nav-base-components"
        title="Navigation base components"
        description="The parts every navigation above is built from: the mobile header and drawer, the account card and its menu, icon and text nav buttons, nav items and the nav list."
        importPath="application/app-navigation/base-components/…"
        exports={["MobileNavigationHeader", "NavAccountCard", "NavAccountMenu", "NavButton", "NavItemBase", "NavList"]}
    >
        <Demo title="MobileNavigationHeader (tap the menu to open the drawer)">
            <MobileHeaderDemo />
        </Demo>

        <Demo title="NavAccountCard and NavAccountMenu" className="items-start gap-8">
            <Labelled label="NavAccountCard (press the chevrons)" className="w-72">
                <NavAccountCard items={ACCOUNTS} selectedAccountId="adviser" popoverPlacement="bottom" />
            </Labelled>
            <Labelled label="NavAccountCard, square avatar">
                <div className="w-72">
                    <NavAccountCard items={ACCOUNTS} selectedAccountId="paraplanner" avatarRounded={false} popoverPlacement="bottom" />
                </div>
            </Labelled>
            <Labelled label="NavAccountMenu (static)">
                <NavAccountMenu aria-label="Account menu" />
            </Labelled>
        </Demo>

        <Demo title="NavButton">
            <Labelled label="Icon only">
                <div className="flex gap-0.5">
                    <NavButton icon={HomeLine} label="Dashboard" href="#/dashboard" />
                    <NavButton icon={Users01} label="Clients" href="#/clients" current />
                    <NavButton icon={PieChart03} label="Portfolios" href="#/portfolios" />
                    <NavButton icon={ShieldTick} label="Compliance" href="#/compliance" />
                </div>
            </Labelled>
            <Labelled label="With text">
                <div className="flex gap-0.5">
                    <NavButton href="#/dashboard">Dashboard</NavButton>
                    <NavButton href="#/clients" current>
                        Clients
                    </NavButton>
                    <NavButton href="#/reports">Reports</NavButton>
                </div>
            </Labelled>
            <Labelled label="Icon and text">
                <NavButton icon={Settings01} href="#/settings" tooltipPlacement="bottom">
                    Settings
                </NavButton>
            </Labelled>
        </Demo>

        <Demo title="NavItemBase" className="items-start gap-8">
            <Labelled label='type="link": default, current, badges, external, disabled' className="w-64">
                <div className="flex flex-col gap-px">
                    <NavItemBase type="link" href="#/dashboard" icon={HomeLine}>
                        Dashboard
                    </NavItemBase>
                    <NavItemBase type="link" href="#/clients" icon={Users01} current badge={128}>
                        Clients
                    </NavItemBase>
                    <NavItemBase
                        type="link"
                        href="#/inbox"
                        icon={Inbox01}
                        badge={
                            <BadgeWithDot color="success" type="modern" size="sm">
                                Live
                            </BadgeWithDot>
                        }
                    >
                        Inbox
                    </NavItemBase>
                    <NavItemBase type="link" href="https://www.fsca.co.za/" icon={BookOpen01}>
                        FSCA regulations
                    </NavItemBase>
                    <NavItemBase type="link" href="#/archive" icon={Briefcase01} isDisabled>
                        Archive (disabled)
                    </NavItemBase>
                </div>
            </Labelled>
            <Labelled label='type="collapsible" with "collapsible-child" items' className="w-64">
                <details open className="appearance-none">
                    <NavItemBase type="collapsible" icon={PieChart03} badge={3}>
                        Portfolios
                    </NavItemBase>
                    <dd>
                        <NavItemBase type="collapsible-child" href="#/portfolios/models">
                            Model portfolios
                        </NavItemBase>
                        <NavItemBase type="collapsible-child" href="#/portfolios/rebalancing" current>
                            Rebalancing
                        </NavItemBase>
                        <NavItemBase type="collapsible-child" href="#/portfolios/performance">
                            Performance
                        </NavItemBase>
                    </dd>
                </details>
            </Labelled>
        </Demo>

        <Demo title="NavList" className="items-start gap-8">
            <Labelled label="Collapsible groups (active: Compliance > FICA checks)" className="w-72">
                <NavList activeUrl="#/compliance/fica" items={NAV_ITEMS} className="px-0 pt-0" />
            </Labelled>
            <Labelled label="With dividers (active: Reports)" className="w-72">
                <NavList activeUrl="#/reports" items={DIVIDED_ITEMS} className="px-0 pt-0" />
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------------------------------------
 * Tabs
 * --------------------------------------------------------------------------------------------- */

const TAB_ITEMS = [
    { id: "overview", label: "Overview" },
    { id: "holdings", label: "Holdings", badge: 12 },
    { id: "transactions", label: "Transactions" },
    { id: "documents", label: "Documents", badge: 3 },
];

const TAB_PANEL_COPY: Record<string, string> = {
    overview: "Balanced portfolio, moderate risk profile. Current value R 1 250 000, up 8.4% over twelve months.",
    holdings: "12 holdings across local equity, offshore equity, bonds, listed property and cash.",
    transactions: "Last transaction: monthly debit order of R 5 000 into the tax-free savings account.",
    documents: "Record of advice, FICA pack and the signed mandate are on file.",
};

const HORIZONTAL_TYPES = ["button-brand", "button-gray", "button-border", "button-minimal", "underline"] as const;
const VERTICAL_TYPES = ["button-brand", "button-gray", "button-border", "button-minimal", "line"] as const;

const TabsSection = () => (
    <ShowcaseSection
        id="app-tabs"
        title="Tabs"
        description="Accessible tabs in five horizontal and five vertical styles, two sizes, with optional icons, count badges and full-width underline."
        importPath="application/tabs/tabs"
        exports={["Tabs", "TabList", "Tab", "TabPanel"]}
    >
        {(["sm", "md"] as const).map((size) => (
            <Demo key={size} title={`Horizontal, size="${size}"`} className="flex-col items-stretch gap-6">
                {HORIZONTAL_TYPES.map((type) => (
                    <Labelled key={type} label={`type="${type}"`}>
                        <Tabs defaultSelectedKey="overview">
                            <TabList aria-label={`Portfolio tabs, ${type}`} type={type} size={size} items={TAB_ITEMS} />
                        </Tabs>
                    </Labelled>
                ))}
            </Demo>
        ))}

        <Demo title="Vertical, sizes sm and md" className="items-start gap-10">
            {VERTICAL_TYPES.map((type) => (
                <Labelled key={type} label={`type="${type}"`}>
                    <Tabs orientation="vertical" defaultSelectedKey="holdings">
                        <TabList aria-label={`Vertical tabs, ${type}`} type={type} size="sm" items={TAB_ITEMS} />
                    </Tabs>
                </Labelled>
            ))}
            <Labelled label='type="line", size="md"'>
                <Tabs orientation="vertical" defaultSelectedKey="documents">
                    <TabList aria-label="Vertical tabs, md" type="line" size="md" items={TAB_ITEMS} />
                </Tabs>
            </Labelled>
        </Demo>

        <Demo title="With icons, badges and panels" className="flex-col items-stretch gap-8">
            <Labelled label="Underline, full width, with panels">
                <Tabs defaultSelectedKey="overview">
                    <TabList aria-label="Client file" type="underline" size="md" fullWidth>
                        <Tab id="overview" icon={HomeLine} label="Overview" />
                        <Tab id="holdings" icon={PieChart03} label="Holdings" badge={12} />
                        <Tab id="transactions" icon={Wallet02} label="Transactions" />
                        <Tab id="documents" icon={FileCheck02} label="Documents" badge={3} />
                    </TabList>
                    {TAB_ITEMS.map((item) => (
                        <TabPanel key={item.id} id={item.id} className="pt-5 text-md text-tertiary">
                            {TAB_PANEL_COPY[item.id]}
                        </TabPanel>
                    ))}
                </Tabs>
            </Labelled>
            <Labelled label="Vertical line tabs with panels">
                <Tabs orientation="vertical" defaultSelectedKey="holdings" className="flex-row gap-8">
                    <TabList aria-label="Client file, vertical" type="line" items={TAB_ITEMS} />
                    {TAB_ITEMS.map((item) => (
                        <TabPanel key={item.id} id={item.id} className="flex-1 rounded-xl bg-secondary p-5 text-md text-secondary">
                            <p className="font-semibold text-primary">{item.label}</p>
                            <p className="mt-1 text-tertiary">{TAB_PANEL_COPY[item.id]}</p>
                        </TabPanel>
                    ))}
                </Tabs>
            </Labelled>
            <Labelled label="Button border with a disabled tab">
                <Tabs defaultSelectedKey="month" disabledKeys={["custom"]}>
                    <TabList aria-label="Reporting period" type="button-border" size="sm">
                        <Tab id="month" label="This month" />
                        <Tab id="quarter" label="This quarter" />
                        <Tab id="year" label="Tax year" />
                        <Tab id="custom" label="Custom" />
                    </TabList>
                </Tabs>
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------------------------------------
 * Table
 * --------------------------------------------------------------------------------------------- */

type ClientStatus = "Active" | "Review due" | "Onboarding" | "Dormant";

interface ClientRow {
    id: string;
    name: string;
    initials: string;
    email: string;
    adviser: string;
    product: string;
    value: number;
    risk: "Conservative" | "Moderate" | "Aggressive";
    status: ClientStatus;
    lastReview: string;
}

const CLIENTS: ClientRow[] = [
    {
        id: "c1",
        name: "Pieter & Anna Viljoen",
        initials: "PV",
        email: "viljoen.household@example.co.za",
        adviser: "Thandi Mokoena",
        product: "Living annuity",
        value: 4850000,
        risk: "Conservative",
        status: "Active",
        lastReview: "2026-06-14",
    },
    {
        id: "c2",
        name: "Kagiso Molefe",
        initials: "KM",
        email: "kagiso.m@example.co.za",
        adviser: "Johan van der Berg",
        product: "Retirement annuity",
        value: 1250000,
        risk: "Moderate",
        status: "Review due",
        lastReview: "2025-08-02",
    },
    {
        id: "c3",
        name: "Fatima Adams",
        initials: "FA",
        email: "fatima.adams@example.co.za",
        adviser: "Ayesha Naidoo",
        product: "Tax-free savings",
        value: 312500,
        risk: "Aggressive",
        status: "Active",
        lastReview: "2026-03-21",
    },
    {
        id: "c4",
        name: "Bongani Zulu",
        initials: "BZ",
        email: "b.zulu@example.co.za",
        adviser: "Thandi Mokoena",
        product: "Endowment",
        value: 780000,
        risk: "Moderate",
        status: "Onboarding",
        lastReview: "2026-09-10",
    },
    {
        id: "c5",
        name: "Megan O'Neill",
        initials: "MO",
        email: "megan.oneill@example.co.za",
        adviser: "Sipho Dlamini",
        product: "Offshore portfolio",
        value: 2140000,
        risk: "Aggressive",
        status: "Active",
        lastReview: "2026-01-30",
    },
    {
        id: "c6",
        name: "Hendrik Steyn",
        initials: "HS",
        email: "hendrik.steyn@example.co.za",
        adviser: "Johan van der Berg",
        product: "Preservation fund",
        value: 965000,
        risk: "Conservative",
        status: "Dormant",
        lastReview: "2024-11-18",
    },
];

const STATUS_COLOURS: Record<ClientStatus, "success" | "warning" | "brand" | "gray"> = {
    Active: "success",
    "Review due": "warning",
    Onboarding: "brand",
    Dormant: "gray",
};

const RISK_COLOURS = { Conservative: "blue", Moderate: "indigo", Aggressive: "pink" } as const;

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

const useSortedClients = (descriptor: SortDescriptor) =>
    useMemo(
        () =>
            [...CLIENTS].sort((a, b) => {
                const column = descriptor.column as keyof ClientRow;
                const first = a[column];
                const second = b[column];
                const order = typeof first === "number" && typeof second === "number" ? first - second : String(first).localeCompare(String(second));
                return descriptor.direction === "descending" ? -order : order;
            }),
        [descriptor],
    );

const ClientsTable = () => {
    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({ column: "value", direction: "descending" });
    const [page, setPage] = useState(1);
    const rows = useSortedClients(sortDescriptor);

    return (
        <TableCard.Root>
            <TableCard.Header
                title="Clients"
                badge="128 clients"
                description="Everyone you advise, with their main product and when they were last reviewed."
                contentTrailing={
                    <div className="flex items-center gap-3">
                        <Button size="md" color="secondary" iconLeading={DownloadCloud02}>
                            Export
                        </Button>
                        <Button size="md" iconLeading={UserPlus01}>
                            Add client
                        </Button>
                        <div className="absolute top-5 right-4 md:static">
                            <TableRowActionsDropdown />
                        </div>
                    </div>
                }
            />
            <Table aria-label="Clients" selectionMode="multiple" defaultSelectedKeys={["c2"]} sortDescriptor={sortDescriptor} onSortChange={setSortDescriptor}>
                <Table.Header>
                    <Table.Head id="name" label="Client" isRowHeader allowsSorting className="w-full max-w-1/4" />
                    <Table.Head id="status" label="Status" allowsSorting />
                    <Table.Head id="product" label="Product" />
                    <Table.Head id="risk" label="Risk profile" tooltip="From the client's latest risk questionnaire." />
                    <Table.Head id="value" label="Portfolio value" allowsSorting />
                    <Table.Head id="lastReview" label="Last review" allowsSorting />
                    <Table.Head id="actions" />
                </Table.Header>
                <Table.Body items={rows}>
                    {(client) => (
                        <Table.Row id={client.id}>
                            <Table.Cell>
                                <div className="flex items-center gap-3">
                                    <Avatar size="md" initials={client.initials} alt={client.name} />
                                    <div className="whitespace-nowrap">
                                        <p className="text-sm font-medium text-primary">{client.name}</p>
                                        <p className="text-sm text-tertiary">{client.email}</p>
                                    </div>
                                </div>
                            </Table.Cell>
                            <Table.Cell>
                                <BadgeWithDot size="sm" type="modern" color={STATUS_COLOURS[client.status]}>
                                    {client.status}
                                </BadgeWithDot>
                            </Table.Cell>
                            <Table.Cell className="whitespace-nowrap">{client.product}</Table.Cell>
                            <Table.Cell>
                                <Badge size="sm" type="pill-color" color={RISK_COLOURS[client.risk]}>
                                    {client.risk}
                                </Badge>
                            </Table.Cell>
                            <Table.Cell className="font-medium whitespace-nowrap text-primary">{formatRand(client.value)}</Table.Cell>
                            <Table.Cell className="whitespace-nowrap">{formatDate(client.lastReview)}</Table.Cell>
                            <Table.Cell className="px-4">
                                <div className="flex justify-end gap-0.5">
                                    <ButtonUtility size="xs" color="tertiary" tooltip="Delete" icon={Trash01} />
                                    <ButtonUtility size="xs" color="tertiary" tooltip="Edit" icon={Edit01} />
                                    <TableRowActionsDropdown />
                                </div>
                            </Table.Cell>
                        </Table.Row>
                    )}
                </Table.Body>
            </Table>
            <PaginationCardDefault page={page} total={13} onPageChange={setPage} />
        </TableCard.Root>
    );
};

const PoliciesTable = () => {
    const [page, setPage] = useState(1);
    const policies = [
        { id: "p1", policy: "NW-LA-20931", holder: "Pieter Viljoen", type: "Life cover", premium: 1450, adviser: "TM" },
        { id: "p2", policy: "NW-DI-11820", holder: "Kagiso Molefe", type: "Disability income", premium: 890, adviser: "JvdB" },
        { id: "p3", policy: "NW-DR-30311", holder: "Fatima Adams", type: "Dread disease", premium: 620, adviser: "AN" },
        { id: "p4", policy: "NW-LA-20477", holder: "Megan O'Neill", type: "Life cover", premium: 2310, adviser: "SD" },
    ];

    return (
        <TableCard.Root size="sm">
            <TableCard.Header
                title="Risk policies"
                badge="4 of 36"
                contentTrailing={
                    <Button size="sm" color="secondary" iconLeading={FilterLines}>
                        Filters
                    </Button>
                }
            />
            <Table aria-label="Risk policies">
                <Table.Header>
                    <Table.Head id="policy" label="Policy" isRowHeader />
                    <Table.Head id="holder" label="Policy holder" />
                    <Table.Head id="type" label="Cover" />
                    <Table.Head id="premium" label="Monthly premium" />
                    <Table.Head id="adviser" label="Adviser" />
                </Table.Header>
                <Table.Body items={policies}>
                    {(row) => (
                        <Table.Row id={row.id}>
                            <Table.Cell className="font-medium text-primary">{row.policy}</Table.Cell>
                            <Table.Cell>{row.holder}</Table.Cell>
                            <Table.Cell>{row.type}</Table.Cell>
                            <Table.Cell>{formatRand(row.premium)}</Table.Cell>
                            <Table.Cell>
                                <Avatar size="xs" initials={row.adviser.slice(0, 2)} />
                            </Table.Cell>
                        </Table.Row>
                    )}
                </Table.Body>
            </Table>
            <PaginationCardMinimal page={page} total={9} onPageChange={setPage} align="right" />
        </TableCard.Root>
    );
};

const TableSection = () => (
    <ShowcaseSection
        id="app-table"
        title="Table"
        description="Accessible data tables inside a TableCard: header with badge and actions, sortable columns, row selection, avatars and badges in cells, row actions, column tooltips and pagination beneath. Two densities: md and sm."
        importPath="application/table/table"
        exports={["Table", "TableCard", "TableRowActionsDropdown"]}
    >
        <Demo title='Selectable, sortable, size="md" with PaginationCardDefault' className="block">
            <ClientsTable />
        </Demo>
        <Demo title='Read-only, size="sm" with PaginationCardMinimal' className="block">
            <PoliciesTable />
        </Demo>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------------------------------------
 * Pagination
 * --------------------------------------------------------------------------------------------- */

/** Renders a pagination with its own page state. */
const Paged = ({ initial = 1, children }: { initial?: number; children: (page: number, setPage: (page: number) => void) => ReactNode }) => {
    const [page, setPage] = useState(initial);
    return <>{children(page, setPage)}</>;
};

const PaginationSection = () => (
    <ShowcaseSection
        id="app-pagination"
        title="Pagination"
        description="Every ready-made pagination in the kit, plus dot and line indicators and the headless Pagination primitives they are built from. All are controlled; these keep their own page state."
        importPath="application/pagination/pagination"
        exports={[
            "PaginationPageDefault",
            "PaginationPageMinimalCenter",
            "PaginationCardDefault",
            "PaginationCardMinimal",
            "PaginationButtonGroup",
            "PaginationCardAdvanced",
        ]}
    >
        <Demo title="Page pagination" className="flex-col items-stretch gap-8">
            <Labelled label="PaginationPageDefault">
                <Paged>{(page, setPage) => <PaginationPageDefault page={page} total={10} onPageChange={setPage} />}</Paged>
            </Labelled>
            <Labelled label="PaginationPageDefault, rounded, page 5 of 20">
                <Paged initial={5}>{(page, setPage) => <PaginationPageDefault rounded page={page} total={20} onPageChange={setPage} />}</Paged>
            </Labelled>
            <Labelled label="PaginationPageMinimalCenter">
                <Paged initial={3}>{(page, setPage) => <PaginationPageMinimalCenter page={page} total={10} onPageChange={setPage} />}</Paged>
            </Labelled>
            <Labelled label="PaginationPageMinimalCenter, rounded">
                <Paged initial={3}>{(page, setPage) => <PaginationPageMinimalCenter rounded page={page} total={10} onPageChange={setPage} />}</Paged>
            </Labelled>
        </Demo>

        <Demo title="Card pagination" className="flex-col items-stretch gap-8">
            <Labelled label="PaginationCardDefault">
                <div className="rounded-xl ring-1 ring-secondary">
                    <Paged>{(page, setPage) => <PaginationCardDefault page={page} total={10} onPageChange={setPage} />}</Paged>
                </div>
            </Labelled>
            <Labelled label="PaginationCardDefault, rounded">
                <div className="rounded-xl ring-1 ring-secondary">
                    <Paged initial={4}>{(page, setPage) => <PaginationCardDefault rounded page={page} total={10} onPageChange={setPage} />}</Paged>
                </div>
            </Labelled>
            {(["left", "center", "right"] as const).map((align) => (
                <Labelled key={align} label={`PaginationCardMinimal, align="${align}"`}>
                    <div className="rounded-xl ring-1 ring-secondary">
                        <Paged initial={2}>{(page, setPage) => <PaginationCardMinimal align={align} page={page} total={10} onPageChange={setPage} />}</Paged>
                    </div>
                </Labelled>
            ))}
            {(["left", "center", "right"] as const).map((align) => (
                <Labelled key={align} label={`PaginationButtonGroup, align="${align}"`}>
                    <div className="rounded-xl ring-1 ring-secondary">
                        <Paged initial={2}>{(page, setPage) => <PaginationButtonGroup align={align} page={page} total={10} onPageChange={setPage} />}</Paged>
                    </div>
                </Labelled>
            ))}
            {(["space-between", "center"] as const).map((align) => (
                <Labelled key={align} label={`PaginationCardAdvanced, align="${align}"`}>
                    <div className="rounded-xl ring-1 ring-secondary">
                        <Paged initial={4}>{(page, setPage) => <PaginationCardAdvanced align={align} page={page} total={24} onPageChange={setPage} />}</Paged>
                    </div>
                </Labelled>
            ))}
        </Demo>

        <Demo title="PaginationDot and PaginationLine" className="items-start gap-10">
            <Labelled label="PaginationDot md / lg">
                <div className="flex flex-col gap-4">
                    <Paged>{(page, setPage) => <PaginationDot page={page} total={5} onPageChange={setPage} />}</Paged>
                    <Paged initial={2}>{(page, setPage) => <PaginationDot size="lg" page={page} total={5} onPageChange={setPage} />}</Paged>
                </div>
            </Labelled>
            <Labelled label="PaginationDot framed">
                <div className="rounded-xl bg-tertiary p-4">
                    <Paged initial={3}>{(page, setPage) => <PaginationDot framed page={page} total={5} onPageChange={setPage} />}</Paged>
                </div>
            </Labelled>
            <Labelled label="PaginationLine md / lg" className="w-48">
                <div className="flex flex-col gap-4">
                    <Paged>{(page, setPage) => <PaginationLine page={page} total={4} onPageChange={setPage} className="w-full" />}</Paged>
                    <Paged initial={2}>{(page, setPage) => <PaginationLine size="lg" page={page} total={4} onPageChange={setPage} className="w-full" />}</Paged>
                </div>
            </Labelled>
            <Labelled label="PaginationLine framed" className="w-56">
                <div className="rounded-xl bg-tertiary p-4">
                    <Paged initial={2}>{(page, setPage) => <PaginationLine framed page={page} total={4} onPageChange={setPage} className="w-full" />}</Paged>
                </div>
            </Labelled>
        </Demo>
        <Demo title="PaginationDot isBrand, on a brand surface" dark>
            <div className="rounded-xl bg-brand-solid p-4">
                <Paged initial={2}>{(page, setPage) => <PaginationDot isBrand size="lg" page={page} total={5} onPageChange={setPage} />}</Paged>
            </div>
        </Demo>

        <Demo title="Pagination (headless primitives: Root, PrevTrigger, NextTrigger, Item, Ellipsis, Context)">
            <Paged initial={6}>
                {(page, setPage) => (
                    <Pagination.Root page={page} total={24} siblingCount={1} onPageChange={setPage} className="flex items-center gap-2">
                        <Pagination.PrevTrigger asChild>
                            <Button size="sm" color="tertiary" iconLeading={ArrowLeft} />
                        </Pagination.PrevTrigger>
                        <Pagination.Context>
                            {({ pages }) =>
                                pages.map((item, index) =>
                                    item.type === "page" ? (
                                        <Pagination.Item
                                            key={index}
                                            {...item}
                                            className={({ isSelected }) =>
                                                cx(
                                                    "flex size-9 cursor-pointer items-center justify-center rounded-full text-sm font-semibold outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                                                    isSelected ? "bg-brand-solid text-white" : "text-tertiary hover:bg-primary_hover",
                                                )
                                            }
                                        >
                                            {item.value}
                                        </Pagination.Item>
                                    ) : (
                                        <Pagination.Ellipsis key={index} className="px-1 text-quaternary">
                                            …
                                        </Pagination.Ellipsis>
                                    ),
                                )
                            }
                        </Pagination.Context>
                        <Pagination.NextTrigger asChild>
                            <Button size="sm" color="tertiary" iconLeading={ArrowRight} />
                        </Pagination.NextTrigger>
                    </Pagination.Root>
                )}
            </Paged>
            <Caption>Imports: Pagination from pagination-base, PaginationDot from pagination-dot, PaginationLine from pagination-line.</Caption>
        </Demo>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------------------------------------
 * Modals
 * --------------------------------------------------------------------------------------------- */

const ModalHeader = ({
    icon,
    color,
    title,
    description,
}: {
    icon: typeof CheckCircle;
    color: "brand" | "success" | "error" | "warning";
    title: string;
    description: string;
}) => (
    <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6 sm:pt-6">
        <FeaturedIcon icon={icon} color={color} theme="light" size="lg" />
        <div className="flex flex-col gap-1">
            <AriaHeading slot="title" className="text-md font-semibold text-primary">
                {title}
            </AriaHeading>
            <p className="text-sm text-tertiary">{description}</p>
        </div>
    </div>
);

const ModalsSection = () => (
    <ShowcaseSection
        id="app-modals"
        title="Modals"
        description="Accessible modal dialogs: DialogTrigger wraps a trigger button and a ModalOverlay > Modal > Dialog. Press Escape, the close button or the backdrop to dismiss."
        importPath="application/modals/modal"
        exports={["DialogTrigger", "ModalOverlay", "Modal", "Dialog"]}
    >
        <Demo title="Open a modal">
            <DialogTrigger>
                <Button color="secondary" iconLeading={CheckCircle}>
                    Approve rebalance
                </Button>
                <ModalOverlay isDismissable>
                    <Modal className="max-w-100">
                        <Dialog>
                            {({ close }) => (
                                <div className="relative w-full">
                                    <CloseButton size="md" className="absolute top-3 right-3" />
                                    <ModalHeader
                                        icon={CheckCircle}
                                        color="success"
                                        title="Approve portfolio rebalance?"
                                        description="The Balanced model will be rebalanced for 42 clients. Trades are placed with the platform at tomorrow's opening prices."
                                    />
                                    <div className="flex flex-col-reverse gap-3 p-4 pt-6 sm:grid sm:grid-cols-2 sm:px-6 sm:pt-8 sm:pb-6">
                                        <Button color="secondary" size="lg" onPress={close}>
                                            Cancel
                                        </Button>
                                        <Button color="primary" size="lg" onPress={close}>
                                            Approve
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Dialog>
                    </Modal>
                </ModalOverlay>
            </DialogTrigger>

            <DialogTrigger>
                <Button color="secondary-destructive" iconLeading={Trash01}>
                    Delete client record
                </Button>
                <ModalOverlay isDismissable>
                    <Modal className="max-w-100">
                        <Dialog role="alertdialog">
                            {({ close }) => (
                                <div className="relative w-full">
                                    <CloseButton size="md" className="absolute top-3 right-3" />
                                    <ModalHeader
                                        icon={AlertTriangle}
                                        color="error"
                                        title="Delete client record"
                                        description="This permanently removes Kagiso Molefe's profile, notes and uploaded documents. Records of advice are kept for five years as required."
                                    />
                                    <div className="px-4 pt-4 sm:px-6">
                                        <Checkbox label="I understand this cannot be undone" size="sm" />
                                    </div>
                                    <div className="flex flex-col-reverse gap-3 p-4 pt-6 sm:grid sm:grid-cols-2 sm:px-6 sm:pt-8 sm:pb-6">
                                        <Button color="secondary" size="lg" onPress={close}>
                                            Cancel
                                        </Button>
                                        <Button color="primary-destructive" size="lg" onPress={close}>
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Dialog>
                    </Modal>
                </ModalOverlay>
            </DialogTrigger>

            <DialogTrigger>
                <Button iconLeading={UserPlus01}>Add new client</Button>
                <ModalOverlay isDismissable>
                    <Modal className="max-w-136">
                        <Dialog>
                            {({ close }) => (
                                <form
                                    className="relative w-full"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        close();
                                    }}
                                >
                                    <CloseButton size="md" className="absolute top-3 right-3" />
                                    <ModalHeader
                                        icon={UserPlus01}
                                        color="brand"
                                        title="Add a new client"
                                        description="Capture the basics now; FICA documents can follow during onboarding."
                                    />
                                    <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6">
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <Input label="First name" placeholder="Thandi" isRequired />
                                            <Input label="Surname" placeholder="Mokoena" isRequired />
                                        </div>
                                        <Input label="Email" type="email" placeholder="client@example.co.za" icon={Mail01} />
                                        <Select
                                            label="Assigned adviser"
                                            placeholder="Choose an adviser"
                                            items={TEAM.slice(0, 4).map(([initials, name], i) => ({
                                                id: initials,
                                                label: name,
                                                avatarUrl: teamAvatars[i].src,
                                            }))}
                                        >
                                            {(item) => (
                                                <Select.Item id={item.id} avatarUrl={item.avatarUrl}>
                                                    {item.label}
                                                </Select.Item>
                                            )}
                                        </Select>
                                        <TextArea label="Notes" placeholder="Goals, dependants, existing products…" rows={3} />
                                        <Checkbox label="Send the onboarding pack by email" defaultSelected size="sm" />
                                    </div>
                                    <div className="flex flex-col-reverse gap-3 p-4 pt-6 sm:flex-row sm:justify-end sm:px-6 sm:pt-8 sm:pb-6">
                                        <Button color="secondary" size="lg" onPress={close}>
                                            Cancel
                                        </Button>
                                        <Button type="submit" color="primary" size="lg">
                                            Add client
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </Dialog>
                    </Modal>
                </ModalOverlay>
            </DialogTrigger>
        </Demo>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------------------------------------
 * Slideout menus
 * --------------------------------------------------------------------------------------------- */

const SlideoutMenusSection = () => (
    <ShowcaseSection
        id="app-slideout-menus"
        title="Slideout menus"
        description="A panel that slides in from the right over an overlay, with a header (close button built in), scrollable content and a footer."
        importPath="application/slideout-menus/slideout-menu"
        exports={["SlideoutMenu"]}
    >
        <Demo title="Open a slideout">
            <SlideoutMenu.Trigger>
                <Button color="secondary" iconLeading={Users01}>
                    View client profile
                </Button>
                <SlideoutMenu isDismissable>
                    {({ close }) => (
                        <>
                            <SlideoutMenu.Header onClose={close} className="flex items-center gap-4">
                                <Avatar size="lg" initials="KM" />
                                <div>
                                    <AriaHeading slot="title" className="text-lg font-semibold text-primary">
                                        Kagiso Molefe
                                    </AriaHeading>
                                    <p className="text-sm text-tertiary">Client since 2019 · Adviser: Johan van der Berg</p>
                                </div>
                            </SlideoutMenu.Header>
                            <SlideoutMenu.Content>
                                <div className="flex gap-2">
                                    <BadgeWithDot color="warning" type="modern" size="sm">
                                        Review due
                                    </BadgeWithDot>
                                    <Badge color="indigo" size="sm">
                                        Moderate risk
                                    </Badge>
                                </div>
                                <dl className="grid grid-cols-2 gap-4 rounded-xl bg-secondary p-4">
                                    {[
                                        ["Portfolio value", "R 1 250 000"],
                                        ["Monthly contribution", "R 5 000"],
                                        ["Retirement age", "65"],
                                        ["Last review", "2 Aug 2025"],
                                    ].map(([term, value]) => (
                                        <div key={term}>
                                            <dt className="text-xs text-tertiary">{term}</dt>
                                            <dd className="text-sm font-semibold text-primary">{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                                <div className="flex flex-col gap-3">
                                    <p className="text-sm font-semibold text-primary">Products</p>
                                    {[
                                        ["Retirement annuity", "R 980 000"],
                                        ["Tax-free savings account", "R 210 000"],
                                        ["Unit trust portfolio", "R 60 000"],
                                    ].map(([product, value]) => (
                                        <div key={product} className="flex items-center justify-between rounded-lg p-3 ring-1 ring-secondary">
                                            <span className="text-sm text-secondary">{product}</span>
                                            <span className="text-sm font-medium text-primary">{value}</span>
                                        </div>
                                    ))}
                                </div>
                                <TextArea label="Adviser note" placeholder="Add a note to the client file…" rows={4} />
                            </SlideoutMenu.Content>
                            <SlideoutMenu.Footer className="flex justify-end gap-3">
                                <Button color="secondary" onPress={close}>
                                    Close
                                </Button>
                                <Button onPress={close}>Schedule review</Button>
                            </SlideoutMenu.Footer>
                        </>
                    )}
                </SlideoutMenu>
            </SlideoutMenu.Trigger>
        </Demo>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------------------------------------
 * Date picker
 * --------------------------------------------------------------------------------------------- */

const now = today(getLocalTimeZone());

type DateRange = { start: DateValue; end: DateValue };

const CalendarDemo = () => {
    const [value, setValue] = useState<DateValue | null>(now.add({ days: 3 }));
    return (
        <div className="flex flex-col gap-3">
            <div className="rounded-2xl bg-primary px-6 py-5 shadow-xl ring ring-secondary_alt">
                <Calendar aria-label="Review date" value={value} onChange={(next) => setValue(next as DateValue)} highlightedDates={[now]} />
            </div>
            <Caption>Selected: {value ? value.toString() : "none"}</Caption>
        </div>
    );
};

const RangeCalendarDemo = () => {
    const [value, setValue] = useState<DateRange | null>({ start: now.subtract({ days: 6 }), end: now });
    const [focusedValue, setFocusedValue] = useState<DateValue>(now);

    const presets = useMemo(
        () => ({
            last7: { label: "Last 7 days", value: { start: now.subtract({ days: 6 }), end: now } },
            last30: { label: "Last 30 days", value: { start: now.subtract({ days: 29 }), end: now } },
            quarter: { label: "Last 90 days", value: { start: now.subtract({ days: 89 }), end: now } },
            taxYear: {
                label: "Tax year to date",
                value: {
                    start: (now.month >= 3 ? now.set({ month: 3, day: 1 }) : now.subtract({ years: 1 }).set({ month: 3, day: 1 })) as DateValue,
                    end: now,
                },
            },
        }),
        [],
    );

    return (
        <RangeCalendarContext.Provider
            value={{
                value,
                onChange: (next) => setValue(next as DateRange),
                focusedValue,
                onFocusChange: setFocusedValue,
            }}
        >
            <div className="flex flex-col gap-3">
                <div className="flex rounded-2xl bg-primary shadow-xl ring ring-secondary_alt">
                    <div className="flex w-40 flex-col gap-0.5 border-r border-secondary p-3">
                        {Object.values(presets).map((preset) => (
                            <RangePresetButton
                                key={preset.label}
                                value={preset.value}
                                onClick={() => {
                                    setValue(preset.value);
                                    setFocusedValue(preset.value.start);
                                }}
                            >
                                {preset.label}
                            </RangePresetButton>
                        ))}
                    </div>
                    <RangeCalendar aria-label="Reporting period" highlightedDates={[now]} presets={presets} showPresetsOnDesktop />
                </div>
                <Caption>
                    Selected: {value ? `${value.start.toString()} to ${value.end.toString()}` : "none"}. Presets as a side list (RangePresetButton) and as links
                    (presets + showPresetsOnDesktop).
                </Caption>
            </div>
        </RangeCalendarContext.Provider>
    );
};

const DatePickerSection = () => (
    <ShowcaseSection
        id="app-date-picker"
        title="Date picker"
        description="Calendar and RangeCalendar on their own, and the DatePicker and DateRangePicker buttons that open them in a popover with apply and cancel. Today is highlighted."
        importPath="application/date-picker/…"
        exports={["Calendar", "RangeCalendar", "RangePresetButton", "DatePicker", "DateRangePicker"]}
    >
        <Demo title="DatePicker and DateRangePicker (press to open)" className="items-start gap-8">
            <Labelled label="DatePicker, empty">
                <DatePicker aria-label="Next review date" />
            </Labelled>
            <Labelled label="DatePicker, with a value, size md">
                <DatePicker aria-label="Contract start" defaultValue={now} size="md" />
            </Labelled>
            <Labelled label="DateRangePicker, empty">
                <DateRangePicker aria-label="Statement period" />
            </Labelled>
            <Labelled label="DateRangePicker, with a value (presets on the left at lg)">
                <DateRangePicker aria-label="Reporting period" defaultValue={{ start: now.subtract({ days: 29 }), end: now }} />
            </Labelled>
        </Demo>
        <Demo title="Calendar" className="items-start">
            <CalendarDemo />
        </Demo>
        <Demo title="RangeCalendar with preset buttons" className="items-start overflow-x-auto">
            <RangeCalendarDemo />
        </Demo>
        <Caption>
            Imports: Calendar from date-picker/calendar, RangeCalendar and RangePresetButton from date-picker/range-calendar, DatePicker and DateRangePicker
            from their own files.
        </Caption>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------------------------------------
 * File upload
 * --------------------------------------------------------------------------------------------- */

type FileType = React.ComponentProps<typeof FileIcon>["type"];

interface UploadItem {
    id: string;
    name: string;
    size: number;
    type: FileType;
    progress: number;
    failed?: boolean;
}

const fileTypeFor = (name: string): FileType => {
    const extension = name.split(".").pop()?.toLowerCase();
    const known = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "jpg", "jpeg", "png", "txt", "zip", "ppt", "pptx"];
    return (extension && known.includes(extension) ? extension : "empty") as FileType;
};

const STATIC_FILES: UploadItem[] = [
    { id: "s1", name: "FICA_proof_of_address.pdf", size: 1_240_000, type: "pdf", progress: 40 },
    { id: "s2", name: "Portfolio_statement_Q2_2026.xlsx", size: 380_000, type: "xlsx", progress: 100 },
    { id: "s3", name: "Signed_mandate_Viljoen.docx", size: 2_860_000, type: "docx", progress: 64, failed: true },
];

const InteractiveUpload = () => {
    const [files, setFiles] = useState<UploadItem[]>([{ id: "i1", name: "Record_of_advice_2026.pdf", size: 820_000, type: "pdf", progress: 100 }]);

    const isUploading = files.some((file) => !file.failed && file.progress < 100);

    useEffect(() => {
        if (!isUploading) return;
        const timer = window.setInterval(() => {
            setFiles((current) =>
                current.map((file) =>
                    file.failed || file.progress >= 100 ? file : { ...file, progress: Math.min(100, file.progress + 7 + Math.round(Math.random() * 8)) },
                ),
            );
        }, 300);
        return () => window.clearInterval(timer);
    }, [isUploading]);

    const addFiles = (list: FileList) => {
        const added = Array.from(list).map((file, index) => ({
            id: `${Date.now()}-${index}`,
            name: file.name,
            size: file.size,
            type: fileTypeFor(file.name),
            progress: 0,
        }));
        setFiles((current) => [...added, ...current]);
    };

    return (
        <FileUpload.Root className="w-full max-w-xl">
            <FileUpload.DropZone
                hint="PDF, DOCX, XLSX or JPG (max. 10 MB)"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png"
                maxSize={10 * 1024 * 1024}
                onDropFiles={addFiles}
            />
            <FileUpload.List>
                {files.map((file) => (
                    <FileUpload.ListItemProgressBar
                        key={file.id}
                        {...file}
                        onDelete={() => setFiles((current) => current.filter((item) => item.id !== file.id))}
                        onRetry={() => setFiles((current) => current.map((item) => (item.id === file.id ? { ...item, failed: false, progress: 0 } : item)))}
                    />
                ))}
            </FileUpload.List>
        </FileUpload.Root>
    );
};

const FileUploadSection = () => (
    <ShowcaseSection
        id="app-file-upload"
        title="File upload"
        description="A drop zone with type and size checks, and file list items in two styles (progress bar and progress fill), each uploading, complete or failed."
        importPath="application/file-upload/file-upload-base"
        exports={["FileUpload", "FileUploadDropZone", "FileListItemProgressBar", "FileListItemProgressFill", "getReadableFileSize"]}
    >
        <Demo title="Interactive: choose or drop files to watch them upload" className="block">
            <InteractiveUpload />
        </Demo>
        <Demo title="Drop zone states" className="grid items-start gap-6 md:grid-cols-2">
            <Labelled label="Default">
                <FileUpload.DropZone hint="PDF or JPG up to 10 MB: ID, proof of address, bank statement" />
            </Labelled>
            <Labelled label="Disabled">
                <FileUpload.DropZone isDisabled hint="Uploads are closed for this client file" />
            </Labelled>
        </Demo>
        <Demo title="List items: uploading, complete and failed" className="grid items-start gap-6 md:grid-cols-2">
            <Labelled label="FileUpload.ListItemProgressBar">
                <FileUpload.List>
                    {STATIC_FILES.map((file) => (
                        <FileUpload.ListItemProgressBar key={file.id} {...file} />
                    ))}
                </FileUpload.List>
            </Labelled>
            <Labelled label="FileUpload.ListItemProgressFill">
                <FileUpload.List>
                    {STATIC_FILES.map((file) => (
                        <FileUpload.ListItemProgressFill key={file.id} {...file} />
                    ))}
                </FileUpload.List>
            </Labelled>
            <Labelled label='fileIconVariant="solid" / "default"'>
                <FileUpload.List>
                    <FileUpload.ListItemProgressBar key="solid" {...STATIC_FILES[1]} fileIconVariant="solid" />
                    <FileUpload.ListItemProgressFill key="default" {...STATIC_FILES[0]} fileIconVariant="default" />
                </FileUpload.List>
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------------------------------------
 * Loading indicator
 * --------------------------------------------------------------------------------------------- */

const LoadingIndicatorSection = () => (
    <ShowcaseSection
        id="app-loading-indicator"
        title="Loading indicator"
        description="Three spinner styles in four sizes, with an optional label."
        importPath="application/loading-indicator/loading-indicator"
        exports={["LoadingIndicator"]}
    >
        {(["line-simple", "line-spinner", "dot-circle"] as const).map((type) => (
            <Demo key={type} title={`type="${type}"`} className="items-end gap-10">
                {(["sm", "md", "lg", "xl"] as const).map((size) => (
                    <Labelled key={size} label={`size="${size}"`} className="items-center">
                        <LoadingIndicator type={type} size={size} label={size === "sm" || size === "lg" ? "Loading portfolios…" : undefined} />
                    </Labelled>
                ))}
            </Demo>
        ))}
    </ShowcaseSection>
);

/* ------------------------------------------------------------------------------------------------
 * Empty state
 * --------------------------------------------------------------------------------------------- */

const EmptyStateSection = () => (
    <ShowcaseSection
        id="app-empty-state"
        title="Empty state"
        description="Composable empty states: a header (featured icon, illustration, file type icon or avatar arrangement over a background pattern), title, description and actions, in three sizes."
        importPath="application/empty-state/empty-state"
        exports={["EmptyState"]}
    >
        <Demo title="Featured icon over each background pattern" className="grid gap-10 md:grid-cols-2">
            {(
                [
                    ["circle", SearchLg, "No clients found", "Your search for “Botha” did not match any clients. Try another name or ID number."],
                    ["grid", Inbox01, "Inbox zero", "No new messages from clients. We'll let you know when one arrives."],
                    ["square", Stars02, "No recommendations yet", "Run a needs analysis to see product recommendations here."],
                    ["grid-check", ClipboardCheck, "Compliance is up to date", "All FICA checks and records of advice are complete."],
                ] as const
            ).map(([pattern, icon, title, description]) => (
                <EmptyState key={pattern} size="md" className="overflow-hidden py-6">
                    <EmptyState.Header pattern={pattern}>
                        <EmptyState.FeaturedIcon icon={icon} color="gray" />
                    </EmptyState.Header>
                    <EmptyState.Content>
                        <EmptyState.Title>{title}</EmptyState.Title>
                        <EmptyState.Description>{description}</EmptyState.Description>
                    </EmptyState.Content>
                    <EmptyState.Footer>
                        <Button color="secondary">Clear search</Button>
                        <Button iconLeading={Plus}>New client</Button>
                    </EmptyState.Footer>
                    <Caption>pattern="{pattern}"</Caption>
                </EmptyState>
            ))}
        </Demo>

        <Demo title="Illustrations" className="grid gap-10 md:grid-cols-2">
            {(
                [
                    ["cloud", "No documents uploaded", "Upload the client's FICA documents to finish onboarding."],
                    ["box", "No products yet", "Add an investment or risk product to this client's file."],
                    ["documents", "No reports generated", "Generate a quarterly review pack to see it listed here."],
                    ["credit-card", "No debit orders", "Set up a monthly contribution to start investing."],
                ] as const
            ).map(([type, title, description]) => (
                <EmptyState key={type} size="md" className="py-6">
                    <EmptyState.Header pattern="none">
                        <EmptyState.Illustration type={type} />
                    </EmptyState.Header>
                    <EmptyState.Content>
                        <EmptyState.Title>{title}</EmptyState.Title>
                        <EmptyState.Description>{description}</EmptyState.Description>
                    </EmptyState.Content>
                    <EmptyState.Footer>
                        <Button iconLeading={Plus}>Add</Button>
                    </EmptyState.Footer>
                </EmptyState>
            ))}
        </Demo>

        <Demo title="Sizes: sm, md, lg" className="grid items-start gap-10 lg:grid-cols-3">
            {(["sm", "md", "lg"] as const).map((size) => (
                <EmptyState key={size} size={size} className="overflow-hidden py-6">
                    <EmptyState.Header pattern="circle" patternSize={size}>
                        <EmptyState.FileTypeIcon type="folder" />
                    </EmptyState.Header>
                    <EmptyState.Content>
                        <EmptyState.Title>No statements in this folder</EmptyState.Title>
                        <EmptyState.Description>Quarterly statements appear here once the platform sends them. (size="{size}")</EmptyState.Description>
                    </EmptyState.Content>
                    <EmptyState.Footer>
                        <Button size={size === "lg" ? "lg" : "md"} color="secondary" iconLeading={DownloadCloud02}>
                            Request statements
                        </Button>
                    </EmptyState.Footer>
                </EmptyState>
            ))}
        </Demo>

        <Demo title="Avatar arrangements: AvatarRadius, AvatarRow, AvatarGrid" className="grid items-start gap-10 lg:grid-cols-3">
            <EmptyState size="md" className="overflow-hidden py-10">
                <EmptyState.Header pattern="none" className="flex size-40 items-center justify-center">
                    <EmptyState.AvatarRadius avatars={teamAvatars} />
                    <EmptyState.FeaturedIcon icon={Users01} color="brand" theme="modern" />
                </EmptyState.Header>
                <EmptyState.Content>
                    <EmptyState.Title>Invite your team</EmptyState.Title>
                    <EmptyState.Description>Advisers and paraplanners can share client files and tasks.</EmptyState.Description>
                </EmptyState.Content>
                <EmptyState.Footer>
                    <Button iconLeading={UserPlus01}>Invite</Button>
                </EmptyState.Footer>
            </EmptyState>
            <EmptyState size="md" className="overflow-hidden py-10">
                <EmptyState.Header pattern="none">
                    <EmptyState.AvatarRow avatars={teamAvatars.slice(0, 6)}>
                        <EmptyState.FeaturedIcon icon={MessageChatCircle} color="gray" />
                    </EmptyState.AvatarRow>
                </EmptyState.Header>
                <EmptyState.Content>
                    <EmptyState.Title>No conversations</EmptyState.Title>
                    <EmptyState.Description>Start a secure conversation with a client.</EmptyState.Description>
                </EmptyState.Content>
                <EmptyState.Footer>
                    <Button color="secondary">New message</Button>
                </EmptyState.Footer>
            </EmptyState>
            <EmptyState size="md" className="overflow-hidden py-10">
                <EmptyState.Header pattern="none">
                    <EmptyState.AvatarGrid avatars={teamAvatars} />
                </EmptyState.Header>
                <EmptyState.Content>
                    <EmptyState.Title>Your client community</EmptyState.Title>
                    <EmptyState.Description>Clients who accept the portal invitation show up here.</EmptyState.Description>
                </EmptyState.Content>
                <EmptyState.Footer>
                    <Button color="secondary">Send invitations</Button>
                </EmptyState.Footer>
            </EmptyState>
        </Demo>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------------------------------------
 * Carousel
 * --------------------------------------------------------------------------------------------- */

const SLIDES = [
    { title: "Retirement planning", body: "Model how much you need to retire comfortably, in today's rands.", className: "bg-brand-solid" },
    { title: "Tax-free savings", body: "Use your R 36 000 annual allowance before the end of February.", className: "bg-navy" },
    { title: "Offshore investing", body: "Diversify with the annual R 1 million single discretionary allowance.", className: "bg-utility-blue-600" },
    { title: "Estate planning", body: "Keep your will, beneficiaries and liquidity needs up to date.", className: "bg-utility-green-600" },
    { title: "Risk cover", body: "Life, disability and dread-disease cover reviewed every year.", className: "bg-utility-pink-600" },
];

const CarouselDots = () => {
    const { selectedIndex, api } = useCarousel();
    return <PaginationDot page={selectedIndex + 1} total={SLIDES.length} onPageChange={(page) => api?.scrollTo(page - 1)} framed />;
};

const CarouselSection = () => (
    <ShowcaseSection
        id="app-carousel"
        title="Carousel"
        description="An Embla-powered carousel: content, items, previous and next triggers and indicators, all composable. Arrow keys work when it has focus."
        importPath="application/carousel/carousel-base"
        exports={["Carousel", "useCarousel"]}
    >
        <Demo title="Single slide with triggers and indicators" className="block">
            <Carousel.Root className="mx-auto max-w-2xl">
                <Carousel.Content className="gap-4">
                    {SLIDES.map((slide) => (
                        <Carousel.Item key={slide.title}>
                            <div className={cx("flex h-64 flex-col justify-end rounded-2xl p-8 text-white", slide.className)}>
                                <p className="text-sm font-semibold text-white/70">Navigate Wealth insights</p>
                                <p className="mt-1 text-display-xs font-semibold">{slide.title}</p>
                                <p className="mt-2 max-w-md text-md text-white/80">{slide.body}</p>
                            </div>
                        </Carousel.Item>
                    ))}
                </Carousel.Content>
                <div className="mt-4 flex items-center justify-between">
                    <Carousel.IndicatorGroup className="flex gap-2">
                        {SLIDES.map((slide, index) => (
                            <Carousel.Indicator
                                key={slide.title}
                                index={index}
                                className={({ isSelected }) =>
                                    cx(
                                        "h-2 cursor-pointer rounded-full outline-focus-ring transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2",
                                        isSelected ? "w-6 bg-fg-brand-primary_alt" : "w-2 bg-quaternary",
                                    )
                                }
                            />
                        ))}
                    </Carousel.IndicatorGroup>
                    <div className="flex gap-2">
                        <Carousel.PrevTrigger>
                            {({ isDisabled, onClick }) => (
                                <Button
                                    size="sm"
                                    color="secondary"
                                    iconLeading={ArrowLeft}
                                    aria-label="Previous slide"
                                    isDisabled={isDisabled}
                                    onPress={onClick}
                                />
                            )}
                        </Carousel.PrevTrigger>
                        <Carousel.NextTrigger>
                            {({ isDisabled, onClick }) => (
                                <Button
                                    size="sm"
                                    color="secondary"
                                    iconLeading={ArrowRight}
                                    aria-label="Next slide"
                                    isDisabled={isDisabled}
                                    onPress={onClick}
                                />
                            )}
                        </Carousel.NextTrigger>
                    </div>
                </div>
            </Carousel.Root>
        </Demo>

        <Demo title="Several per view, looping, with PaginationDot via useCarousel" className="block">
            <Carousel.Root opts={{ loop: true, align: "start" }}>
                <Carousel.Content className="-ml-4">
                    {SLIDES.map((slide) => (
                        <Carousel.Item key={slide.title} className="pl-4 sm:basis-1/2 lg:basis-1/3">
                            <div className="flex h-44 flex-col justify-between rounded-xl bg-secondary p-5 ring-1 ring-secondary">
                                <span className={cx("size-8 rounded-lg", slide.className)} />
                                <div>
                                    <p className="text-md font-semibold text-primary">{slide.title}</p>
                                    <p className="text-sm text-tertiary">{slide.body}</p>
                                </div>
                            </div>
                        </Carousel.Item>
                    ))}
                </Carousel.Content>
                <div className="mt-4 flex justify-center">
                    <CarouselDots />
                </div>
            </Carousel.Root>
        </Demo>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------------------------------------
 * Charts
 * --------------------------------------------------------------------------------------------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const AUM_DATA = MONTHS.map((month, i) => ({
    month,
    aum: Math.round(1080 + i * 16 + Math.sin(i * 0.9) * 22),
    benchmark: Math.round(1080 + i * 12),
}));

const RETURNS_DATA = MONTHS.map((month, i) => ({
    month,
    balanced: +(0.8 * i + Math.sin(i * 0.8) * 1.2).toFixed(1),
    equity: +(1.1 * i + Math.sin(i * 1.1) * 2.6).toFixed(1),
    inflation: +(0.45 * i).toFixed(1),
}));

const FLOWS_DATA = MONTHS.map((month, i) => ({
    month,
    inflows: Math.round(22 + Math.sin(i * 0.7) * 8 + (i % 3) * 3),
    outflows: Math.round(12 + Math.cos(i * 0.6) * 4),
}));

const ALLOCATION_DATA = [
    { name: "Local equity", value: 38, className: "text-utility-brand-600" },
    { name: "Offshore equity", value: 27, className: "text-utility-brand-400" },
    { name: "Bonds", value: 18, className: "text-utility-blue-500" },
    { name: "Listed property", value: 9, className: "text-utility-pink-500" },
    { name: "Cash", value: 8, className: "text-utility-neutral-300" },
];

const ChartCard = ({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) => (
    <div className="flex w-full flex-col gap-5 rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary">
        <div>
            <p className="text-md font-semibold text-primary">{title}</p>
            <p className="text-sm text-tertiary">{subtitle}</p>
        </div>
        {children}
    </div>
);

const AumAreaChart = () => {
    const isDesktop = useBreakpoint("lg");

    return (
        <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={AUM_DATA} className="text-tertiary [&_.recharts-text]:text-xs" margin={{ left: 5, right: 5, top: 5, bottom: 5 }}>
                <defs>
                    <linearGradient id="nw-aum-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="currentColor" className="text-utility-brand-600" stopOpacity="0.5" />
                        <stop offset="95%" stopColor="currentColor" className="text-utility-brand-600" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="currentColor" className="text-utility-neutral-100" />
                <Legend
                    verticalAlign="top"
                    align="right"
                    layout={isDesktop ? "vertical" : "horizontal"}
                    content={<ChartLegendContent className="-translate-y-2" />}
                />
                <XAxis
                    dataKey="month"
                    fill="currentColor"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    interval="preserveStartEnd"
                    ticks={selectEvenlySpacedItems(AUM_DATA, isDesktop ? 12 : 6).map((item) => item.month)}
                />
                <YAxis
                    width={72}
                    fill="currentColor"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: number) => `R${value}m`}
                    domain={["dataMin - 40", "auto"]}
                />
                <RechartsTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value) => `R ${Number(value).toLocaleString("en-ZA")}m`}
                    labelFormatter={(label) => `${label} 2026`}
                    cursor={{ className: "stroke-utility-brand-600 stroke-2" }}
                />
                <Area
                    isAnimationActive={false}
                    className="text-utility-brand-600 [&_.recharts-area-area]:translate-y-1.5 [&_.recharts-area-area]:[clip-path:inset(0_0_6px_0)]"
                    dataKey="aum"
                    name="Assets under advice"
                    type="monotone"
                    stroke="currentColor"
                    strokeWidth={2}
                    fill="url(#nw-aum-gradient)"
                    fillOpacity={0.1}
                    activeDot={<ChartActiveDot />}
                />
                <Area
                    isAnimationActive={false}
                    className="text-utility-neutral-400"
                    dataKey="benchmark"
                    name="Plan"
                    type="monotone"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fill="none"
                    activeDot={false}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
};

const ReturnsLineChart = () => {
    const isDesktop = useBreakpoint("lg");

    return (
        <ResponsiveContainer width="100%" height={280}>
            <LineChart data={RETURNS_DATA} className="text-tertiary [&_.recharts-text]:text-xs" margin={{ left: 5, right: 5, top: 5, bottom: 5 }}>
                <CartesianGrid vertical={false} stroke="currentColor" className="text-utility-neutral-100" />
                <Legend verticalAlign="top" align="right" layout={isDesktop ? "vertical" : "horizontal"} content={<ChartLegendContent />} />
                <XAxis
                    dataKey="month"
                    fill="currentColor"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    interval="preserveStartEnd"
                    ticks={selectEvenlySpacedItems(RETURNS_DATA, isDesktop ? 12 : 6).map((item) => item.month)}
                />
                <YAxis fill="currentColor" axisLine={false} tickLine={false} tickFormatter={(value: number) => `${value}%`} />
                <RechartsTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value) => `${value}%`}
                    labelFormatter={(label) => `${label} 2026`}
                    cursor={{ className: "stroke-utility-brand-600 stroke-2" }}
                />
                <Line
                    isAnimationActive={false}
                    className="text-utility-brand-600"
                    dataKey="balanced"
                    name="NW Balanced Fund"
                    type="monotone"
                    stroke="currentColor"
                    strokeWidth={2}
                    dot={false}
                    activeDot={<ChartActiveDot />}
                />
                <Line
                    isAnimationActive={false}
                    className="text-utility-brand-400"
                    dataKey="equity"
                    name="NW Equity Fund"
                    type="monotone"
                    stroke="currentColor"
                    strokeWidth={2}
                    dot={false}
                    activeDot={<ChartActiveDot />}
                />
                <Line
                    isAnimationActive={false}
                    className="text-utility-neutral-400"
                    dataKey="inflation"
                    name="CPI"
                    type="monotone"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeDasharray="0.1 8"
                    strokeLinecap="round"
                    dot={false}
                    activeDot={false}
                />
            </LineChart>
        </ResponsiveContainer>
    );
};

const FlowsBarChart = ({ stacked = false }: { stacked?: boolean }) => {
    const isDesktop = useBreakpoint("lg");

    return (
        <ResponsiveContainer width="100%" height={280}>
            <BarChart data={FLOWS_DATA} className="text-tertiary [&_.recharts-text]:text-xs" margin={{ left: 5, right: 5, top: 5, bottom: 5 }}>
                <CartesianGrid vertical={false} stroke="currentColor" className="text-utility-neutral-100" />
                <Legend verticalAlign="top" align="right" layout={isDesktop ? "vertical" : "horizontal"} content={<ChartLegendContent />} />
                <XAxis
                    dataKey="month"
                    fill="currentColor"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    ticks={selectEvenlySpacedItems(FLOWS_DATA, isDesktop ? 12 : 6).map((item) => item.month)}
                />
                <YAxis fill="currentColor" axisLine={false} tickLine={false} tickFormatter={(value: number) => `R${value}m`} />
                <RechartsTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value) => `R ${value}m`}
                    labelFormatter={(label) => `${label} 2026`}
                    cursor={{ className: "fill-utility-neutral-200 opacity-30" }}
                />
                <Bar
                    isAnimationActive={false}
                    className="text-utility-brand-600"
                    dataKey="inflows"
                    name="Inflows"
                    fill="currentColor"
                    stackId={stacked ? "flows" : undefined}
                    maxBarSize={stacked ? 32 : 16}
                    radius={stacked ? [0, 0, 0, 0] : [6, 6, 0, 0]}
                />
                <Bar
                    isAnimationActive={false}
                    className="text-utility-brand-300"
                    dataKey="outflows"
                    name="Outflows"
                    fill="currentColor"
                    stackId={stacked ? "flows" : undefined}
                    maxBarSize={stacked ? 32 : 16}
                    radius={[6, 6, 0, 0]}
                />
            </BarChart>
        </ResponsiveContainer>
    );
};

const AllocationPieChart = ({ donut = false }: { donut?: boolean }) => (
    <ResponsiveContainer width="100%" height={260}>
        <PieChart margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
            <Legend verticalAlign="middle" align="right" layout="vertical" content={<ChartLegendContent />} />
            <RechartsTooltip content={<ChartTooltipContent isPieChart />} formatter={(value) => `${value}%`} />
            <Pie
                isAnimationActive={false}
                startAngle={-270}
                endAngle={-630}
                stroke="none"
                data={ALLOCATION_DATA}
                dataKey="value"
                nameKey="name"
                fill="currentColor"
                innerRadius={donut ? 70 : 0}
                outerRadius={110}
                paddingAngle={donut ? 2 : 0}
                cornerRadius={donut ? 4 : 0}
            >
                {ALLOCATION_DATA.map((entry) => (
                    <Cell key={entry.name} className={entry.className} fill="currentColor" />
                ))}
            </Pie>
        </PieChart>
    </ResponsiveContainer>
);

const ChartsSection = () => (
    <ShowcaseSection
        id="app-charts"
        title="Charts"
        description="Recharts, styled with the kit's chart helpers: ChartTooltipContent, ChartLegendContent, ChartActiveDot and selectEvenlySpacedItems for x-axis ticks. Series take their colour from utility classes via currentColor. Hover for tooltips."
        importPath="application/charts/charts-base"
        exports={["ChartTooltipContent", "ChartLegendContent", "ChartActiveDot", "selectEvenlySpacedItems"]}
    >
        <Demo title="Area chart" className="block">
            <ChartCard title="Assets under advice" subtitle="R 1 250 million at the end of September, against the business plan.">
                <AumAreaChart />
            </ChartCard>
        </Demo>
        <Demo title="Line chart" className="block">
            <ChartCard title="Cumulative fund returns" subtitle="Year to date, after fees, against inflation.">
                <ReturnsLineChart />
            </ChartCard>
        </Demo>
        <Demo title="Bar charts: grouped and stacked" className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Net flows" subtitle="Monthly inflows and outflows, R million.">
                <FlowsBarChart />
            </ChartCard>
            <ChartCard title="Gross flows" subtitle="Inflows and outflows stacked, R million.">
                <FlowsBarChart stacked />
            </ChartCard>
        </Demo>
        <Demo title="Pie and donut charts" className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Asset allocation" subtitle="Balanced model portfolio, % of R 1 250 000.">
                <AllocationPieChart />
            </ChartCard>
            <ChartCard title="Asset allocation (donut)" subtitle="The same allocation as a donut.">
                <AllocationPieChart donut />
            </ChartCard>
        </Demo>
        <Caption>
            <CoinsStacked01 className="mr-1 inline size-3" />
            Charts are built directly with recharts; the kit supplies the styled tooltip, legend and active dot.
        </Caption>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------------------------------------
 * Group
 * --------------------------------------------------------------------------------------------- */

const ApplicationSections = () => (
    <>
        <SidebarSimpleSection />
        <SidebarSlimSection />
        <SidebarDualTierSection />
        <SidebarSectionDividersSection />
        <SidebarSubheadingsSection />
        <HeaderNavigationSection />
        <NavBaseComponentsSection />
        <TabsSection />
        <TableSection />
        <PaginationSection />
        <ModalsSection />
        <SlideoutMenusSection />
        <DatePickerSection />
        <FileUploadSection />
        <LoadingIndicatorSection />
        <EmptyStateSection />
        <CarouselSection />
        <ChartsSection />
    </>
);

export const applicationGroup: ShowcaseGroup = {
    id: "application",
    title: "Application components",
    description:
        "The complex patterns a Navigate Wealth app screen is made of: navigation, tabs, data tables, pagination, modals and slideouts, date pickers, uploads, loading and empty states, carousels and charts.",
    entries: [
        { id: "app-sidebar-simple", title: "Sidebar navigation: simple" },
        { id: "app-sidebar-slim", title: "Sidebar navigation: slim" },
        { id: "app-sidebar-dual-tier", title: "Sidebar navigation: dual tier" },
        { id: "app-sidebar-section-dividers", title: "Sidebar navigation: section dividers" },
        { id: "app-sidebar-subheadings", title: "Sidebar navigation: sections with subheadings" },
        { id: "app-header-navigation", title: "Header navigation" },
        { id: "app-nav-base-components", title: "Navigation base components" },
        { id: "app-tabs", title: "Tabs" },
        { id: "app-table", title: "Table" },
        { id: "app-pagination", title: "Pagination" },
        { id: "app-modals", title: "Modals" },
        { id: "app-slideout-menus", title: "Slideout menus" },
        { id: "app-date-picker", title: "Date picker" },
        { id: "app-file-upload", title: "File upload" },
        { id: "app-loading-indicator", title: "Loading indicator" },
        { id: "app-empty-state", title: "Empty state" },
        { id: "app-carousel", title: "Carousel" },
        { id: "app-charts", title: "Charts" },
    ],
    Component: ApplicationSections,
};
