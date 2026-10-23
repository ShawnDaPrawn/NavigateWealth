/**
 * Base components: every building block in src/components/base that is not a
 * form input — buttons, badges, avatars, tags, tooltips, selection controls,
 * sliders and progress indicators — in the Navigate Wealth theme.
 */
import { type MouseEvent, type ReactNode, useState } from "react";
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    ArrowRight,
    ArrowUpRight,
    BarChart01,
    Briefcase01,
    Building07,
    Calendar,
    CheckCircle,
    Copy01,
    Download01,
    Edit01,
    Grid01,
    HelpCircle,
    InfoCircle,
    LayoutGrid01,
    List,
    Mail01,
    PieChart01,
    Plus,
    Settings01,
    ShieldTick,
    Star01,
    Trash01,
    TrendUp01,
    Users01,
    Wallet02,
    Zap,
} from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { AvatarLabelGroup } from "@/components/base/avatar/avatar-label-group";
import { AvatarProfilePhoto } from "@/components/base/avatar/avatar-profile-photo";
import { AvatarAddButton, AvatarCompanyIcon, AvatarOnlineIndicator, VerifiedTick } from "@/components/base/avatar/base-components";
import { AvatarCount } from "@/components/base/avatar/base-components/avatar-count";
import { getInitials } from "@/components/base/avatar/utils";
import { BadgeGroup } from "@/components/base/badges/badge-groups";
import type { BadgeColors } from "@/components/base/badges/badge-types";
import { Badge, BadgeIcon, BadgeWithButton, BadgeWithDot, BadgeWithFlag, BadgeWithIcon, BadgeWithImage } from "@/components/base/badges/badges";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import * as StoreFilled from "@/components/base/buttons/app-store-buttons";
import * as StoreOutline from "@/components/base/buttons/app-store-buttons-outline";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { CloseButton } from "@/components/base/buttons/close-button";
import { SocialButton } from "@/components/base/buttons/social-button";
import { AppleLogo, DribbleLogo, FacebookLogo, FigmaLogo, FigmaLogoOutlined, GoogleLogo, TwitterLogo } from "@/components/base/buttons/social-logos";
import { Checkbox, CheckboxBase } from "@/components/base/checkbox/checkbox";
import { ProgressBarCircle, ProgressBarHalfCircle } from "@/components/base/progress-indicators/progress-circles";
import { ProgressBar, ProgressBarBase } from "@/components/base/progress-indicators/progress-indicators";
import { CircleProgressBar } from "@/components/base/progress-indicators/simple-circle";
import { RadioButton, RadioButtonBase, RadioGroup } from "@/components/base/radio-buttons/radio-buttons";
import { Slider } from "@/components/base/slider/slider";
import { TagCheckbox } from "@/components/base/tags/base-components/tag-checkbox";
import { TagCloseX } from "@/components/base/tags/base-components/tag-close-x";
import { Tag, TagAvatar, TagGroup, TagList } from "@/components/base/tags/tags";
import { Toggle, ToggleBase } from "@/components/base/toggle/toggle";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { Demo, Labelled, type ShowcaseGroup, ShowcaseSection } from "../showcase-kit";

/* ------------------------------------------------------------------ */
/* Sample data                                                         */
/* ------------------------------------------------------------------ */

/** An inline SVG "photo" (initials on a colour), so nothing loads from the network. */
const portrait = (initials: string, background: string, foreground = "#ffffff") =>
    `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${background}"/><text x="32" y="41" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="600" fill="${foreground}">${initials}</text></svg>`,
    )}`;

/** Fictional Navigate Wealth advisers and clients. */
const PEOPLE = [
    { name: "Thandi Mokoena", role: "Senior wealth adviser", src: portrait("TM", "#1e3a5f") },
    { name: "Pieter van Wyk", role: "Retirement planning", src: portrait("PW", "#2f6f73") },
    { name: "Aisha Naidoo", role: "Client, Balanced Growth", src: portrait("AN", "#b7791f") },
    { name: "Sipho Dlamini", role: "Client, Offshore Equity", src: portrait("SD", "#6b46c1") },
    { name: "Lerato Khumalo", role: "Paraplanner", src: portrait("LK", "#c05621") },
];

const COMPANY_ICON = portrait("NW", "#0b1f3a", "#e8c872");

const preventNavigation = (event: MouseEvent<HTMLAnchorElement>) => event.preventDefault();

const BUTTON_SIZES = ["xs", "sm", "md", "lg", "xl"] as const;
const BUTTON_COLORS = [
    "primary",
    "secondary",
    "tertiary",
    "link-color",
    "link-gray",
    "primary-destructive",
    "secondary-destructive",
    "tertiary-destructive",
    "link-destructive",
] as const;

const BADGE_COLORS: BadgeColors[] = ["gray", "brand", "error", "warning", "success", "slate", "sky", "blue", "indigo", "purple", "pink", "orange"];
const BADGE_SIZES = ["sm", "md", "lg"] as const;
const BADGE_LABEL: Record<BadgeColors, string> = {
    gray: "Draft",
    brand: "Navigate",
    error: "Overdue",
    warning: "Review due",
    success: "Compliant",
    slate: "Archived",
    sky: "Offshore",
    blue: "Equity",
    indigo: "Bonds",
    purple: "Property",
    pink: "Education",
    orange: "Pending",
};

const SOCIALS = ["google", "facebook", "apple", "twitter", "figma", "dribble"] as const;
const SOCIAL_NAMES: Record<(typeof SOCIALS)[number], string> = {
    google: "Google",
    facebook: "Facebook",
    apple: "Apple",
    twitter: "X",
    figma: "Figma",
    dribble: "Dribbble",
};

const AVATAR_SIZES = ["xs", "sm", "md", "lg", "xl", "2xl"] as const;

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

const ButtonsSection = () => (
    <ShowcaseSection
        id="base-buttons"
        title="Buttons"
        description="The primary action control. Five sizes, nine hierarchies (including destructive and link styles), leading and trailing icons, icon-only, loading and disabled states, and a link variant that renders an anchor."
        importPath="base/buttons/button"
        exports={["Button"]}
    >
        <Demo title="Every hierarchy × every size" className="block overflow-x-auto">
            <table className="w-full border-separate border-spacing-x-4 border-spacing-y-3 text-left">
                <thead>
                    <tr>
                        <th className="text-xs font-medium text-quaternary">color</th>
                        {BUTTON_SIZES.map((size) => (
                            <th key={size} className="text-xs font-medium text-quaternary">
                                {size}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {BUTTON_COLORS.map((color) => (
                        <tr key={color}>
                            <td className="pr-2 font-mono text-xs whitespace-nowrap text-tertiary">{color}</td>
                            {BUTTON_SIZES.map((size) => (
                                <td key={size}>
                                    <Button size={size} color={color}>
                                        {color.includes("destructive") ? "Close account" : "Book a review"}
                                    </Button>
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </Demo>

        <Demo title="Icons">
            <Labelled label="iconLeading">
                <Button iconLeading={Plus}>New client</Button>
            </Labelled>
            <Labelled label="iconTrailing">
                <Button color="secondary" iconTrailing={ArrowRight}>
                    View portfolio
                </Button>
            </Labelled>
            <Labelled label="both">
                <Button color="secondary" iconLeading={Download01} iconTrailing={ArrowUpRight}>
                    Tax certificate
                </Button>
            </Labelled>
            <Labelled label="primary-destructive + icon">
                <Button color="primary-destructive" iconLeading={Trash01}>
                    Delete mandate
                </Button>
            </Labelled>
            <Labelled label="link-color + icon">
                <Button color="link-color" iconTrailing={ArrowRight}>
                    Read the market note
                </Button>
            </Labelled>
        </Demo>

        <Demo title="Icon only, every size">
            {BUTTON_SIZES.map((size) => (
                <Labelled key={size} label={size}>
                    <div className="flex gap-2">
                        <Button size={size} iconLeading={Plus} aria-label="Add" />
                        <Button size={size} color="secondary" iconLeading={Edit01} aria-label="Edit" />
                        <Button size={size} color="tertiary" iconLeading={Settings01} aria-label="Settings" />
                        <Button size={size} color="secondary-destructive" iconLeading={Trash01} aria-label="Delete" />
                    </div>
                </Labelled>
            ))}
        </Demo>

        <Demo title="Loading and disabled">
            <Labelled label="isLoading">
                <Button isLoading>Submitting</Button>
            </Labelled>
            <Labelled label="isLoading + showTextWhileLoading">
                <Button color="secondary" isLoading showTextWhileLoading>
                    Generating report
                </Button>
            </Labelled>
            <Labelled label="destructive loading">
                <Button color="primary-destructive" isLoading showTextWhileLoading>
                    Cancelling
                </Button>
            </Labelled>
            <Labelled label="isDisabled">
                <div className="flex flex-wrap gap-2">
                    <Button isDisabled>Primary</Button>
                    <Button color="secondary" isDisabled>
                        Secondary
                    </Button>
                    <Button color="tertiary" isDisabled>
                        Tertiary
                    </Button>
                    <Button color="link-color" isDisabled>
                        Link
                    </Button>
                    <Button color="primary-destructive" isDisabled>
                        Destructive
                    </Button>
                </div>
            </Labelled>
        </Demo>

        <Demo title="As a link (href renders an anchor)">
            <Labelled label='href + color="primary"'>
                <Button href="#base-buttons" iconTrailing={ArrowUpRight}>
                    Open client portal
                </Button>
            </Labelled>
            <Labelled label='href + color="secondary"'>
                <Button href="#base-buttons" color="secondary">
                    Fee schedule
                </Button>
            </Labelled>
            <Labelled label='href + color="link-gray"'>
                <Button href="#base-buttons" color="link-gray">
                    Privacy notice
                </Button>
            </Labelled>
            <Labelled label="href + isDisabled">
                <Button href="#base-buttons" color="secondary" isDisabled>
                    Unavailable
                </Button>
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

const ButtonUtilitySection = () => (
    <ShowcaseSection
        id="base-button-utility"
        title="Utility buttons"
        description="Compact icon buttons for toolbars and table rows. The tooltip doubles as the accessible label."
        importPath="base/buttons/button-utility"
        exports={["ButtonUtility"]}
    >
        <Demo title="Colours × sizes">
            {(["secondary", "tertiary"] as const).map((color) =>
                (["sm", "xs"] as const).map((size) => (
                    <Labelled key={`${color}-${size}`} label={`${color} · ${size}`}>
                        <div className="flex gap-1">
                            <ButtonUtility color={color} size={size} icon={Copy01} tooltip="Copy account number" />
                            <ButtonUtility color={color} size={size} icon={Edit01} tooltip="Edit" />
                            <ButtonUtility color={color} size={size} icon={Download01} tooltip="Download statement" />
                            <ButtonUtility color={color} size={size} icon={Trash01} tooltip="Delete" />
                        </div>
                    </Labelled>
                )),
            )}
        </Demo>
        <Demo title="States">
            <Labelled label="isDisabled">
                <ButtonUtility icon={Trash01} tooltip="Delete" isDisabled className="self-start" />
            </Labelled>
            <Labelled label='tooltipPlacement="bottom"'>
                <ButtonUtility icon={InfoCircle} tooltip="Figures are in rand" tooltipPlacement="bottom" className="self-start" />
            </Labelled>
            <Labelled label="as a link (href)">
                <ButtonUtility href="#base-button-utility" icon={ArrowUpRight} tooltip="Open in new view" className="self-start" />
            </Labelled>
            <Labelled label="no tooltip (aria-label)">
                <ButtonUtility icon={Settings01} aria-label="Settings" color="tertiary" className="self-start" />
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

const CloseButtonSection = () => (
    <ShowcaseSection
        id="base-close-button"
        title="Close button"
        description="Dismisses modals, slideouts and notifications. Fills the React Aria “close” slot, so it closes a parent dialog without a handler."
        importPath="base/buttons/close-button"
        exports={["CloseButton"]}
    >
        <Demo title='theme="light"'>
            {(["xs", "sm", "md", "lg"] as const).map((size) => (
                <Labelled key={size} label={size}>
                    <CloseButton size={size} slot={null} />
                </Labelled>
            ))}
        </Demo>
        <Demo title='theme="dark"' dark>
            {(["xs", "sm", "md", "lg"] as const).map((size) => (
                <CloseButton key={size} size={size} theme="dark" slot={null} label={`Close (${size})`} />
            ))}
        </Demo>
    </ShowcaseSection>
);

const SocialButtonsSection = () => (
    <ShowcaseSection
        id="base-social-buttons"
        title="Social buttons"
        description="Single sign-on and share buttons for six brands, in three themes (brand, colour, gray) and two sizes, with or without text."
        importPath="base/buttons/social-button"
        exports={["SocialButton"]}
    >
        {(["brand", "color", "gray"] as const).map((theme) => (
            <Demo key={theme} title={`theme="${theme}"`} className="flex-col items-start">
                {(["lg", "md"] as const).map((size) => (
                    <Labelled key={size} label={`size="${size}" · with text`}>
                        <div className="flex flex-wrap gap-3">
                            {SOCIALS.map((social) => (
                                <SocialButton key={social} social={social} theme={theme} size={size}>
                                    Sign in with {SOCIAL_NAMES[social]}
                                </SocialButton>
                            ))}
                        </div>
                    </Labelled>
                ))}
                {(["lg", "md"] as const).map((size) => (
                    <Labelled key={`icon-${size}`} label={`size="${size}" · icon only`}>
                        <div className="flex flex-wrap gap-3">
                            {SOCIALS.map((social) => (
                                <SocialButton key={social} social={social} theme={theme} size={size} aria-label={`Sign in with ${SOCIAL_NAMES[social]}`} />
                            ))}
                        </div>
                    </Labelled>
                ))}
            </Demo>
        ))}
        <Demo title="States">
            <Labelled label="isDisabled">
                <SocialButton social="google" theme="gray" isDisabled>
                    Sign in with Google
                </SocialButton>
            </Labelled>
            <Labelled label="as a link (href)">
                <SocialButton social="apple" href="#base-social-buttons">
                    Continue with Apple
                </SocialButton>
            </Labelled>
        </Demo>
        <Demo title="Social logos (social-logos.tsx)">
            <Labelled label="GoogleLogo colorful">
                <GoogleLogo colorful className="size-6" />
            </Labelled>
            <Labelled label="GoogleLogo">
                <GoogleLogo className="size-6 text-fg-quaternary" />
            </Labelled>
            <Labelled label="FacebookLogo colorful">
                <FacebookLogo colorful className="size-6" />
            </Labelled>
            <Labelled label="FacebookLogo">
                <FacebookLogo className="size-6 text-fg-quaternary" />
            </Labelled>
            <Labelled label="AppleLogo">
                <AppleLogo className="size-6 text-primary" />
            </Labelled>
            <Labelled label="TwitterLogo">
                <TwitterLogo className="size-6 text-primary" />
            </Labelled>
            <Labelled label="FigmaLogo colorful">
                <FigmaLogo colorful className="size-6" />
            </Labelled>
            <Labelled label="FigmaLogo">
                <FigmaLogo className="size-6 text-fg-quaternary" />
            </Labelled>
            <Labelled label="FigmaLogoOutlined">
                <FigmaLogoOutlined className="size-6 text-fg-quaternary" />
            </Labelled>
            <Labelled label="DribbleLogo colorful">
                <DribbleLogo colorful className="size-6" />
            </Labelled>
            <Labelled label="DribbleLogo">
                <DribbleLogo className="size-6 text-fg-quaternary" />
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

const AppStoreButtonsSection = () => (
    <ShowcaseSection
        id="base-app-store-buttons"
        title="App store buttons"
        description="Official store badges for the Navigate Wealth mobile app. Two files: filled (app-store-buttons) and outline (app-store-buttons-outline), each in md and lg."
        importPath="base/buttons/app-store-buttons"
        exports={["GooglePlayButton", "GooglePlayWhiteButton", "AppStoreButton", "GalaxyStoreButton", "AppGalleryButton"]}
    >
        {(["md", "lg"] as const).map((size) => (
            <Demo key={size} title={`Filled · size="${size}"`}>
                <Labelled label="GooglePlayButton">
                    <StoreFilled.GooglePlayButton size={size} onClick={preventNavigation} />
                </Labelled>
                <Labelled label="GooglePlayWhiteButton">
                    <StoreFilled.GooglePlayWhiteButton size={size} onClick={preventNavigation} />
                </Labelled>
                <Labelled label="AppStoreButton">
                    <StoreFilled.AppStoreButton size={size} onClick={preventNavigation} />
                </Labelled>
                <Labelled label="GalaxyStoreButton">
                    <StoreFilled.GalaxyStoreButton size={size} onClick={preventNavigation} />
                </Labelled>
                <Labelled label="AppGalleryButton">
                    <StoreFilled.AppGalleryButton size={size} onClick={preventNavigation} />
                </Labelled>
            </Demo>
        ))}
        {(["md", "lg"] as const).map((size) => (
            <Demo key={size} title={`Outline (app-store-buttons-outline) · size="${size}"`}>
                <Labelled label="GooglePlayButton">
                    <StoreOutline.GooglePlayButton size={size} onClick={preventNavigation} />
                </Labelled>
                <Labelled label="AppStoreButton">
                    <StoreOutline.AppStoreButton size={size} onClick={preventNavigation} />
                </Labelled>
                <Labelled label="GalaxyStoreButton">
                    <StoreOutline.GalaxyStoreButton size={size} onClick={preventNavigation} />
                </Labelled>
                <Labelled label="AppGalleryButton">
                    <StoreOutline.AppGalleryButton size={size} onClick={preventNavigation} />
                </Labelled>
            </Demo>
        ))}
        <Demo title="Filled on the navy surface" dark>
            <StoreFilled.AppStoreButton onClick={preventNavigation} />
            <StoreFilled.GooglePlayButton onClick={preventNavigation} />
            <StoreFilled.GooglePlayWhiteButton onClick={preventNavigation} />
        </Demo>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------ */
/* Button group                                                        */
/* ------------------------------------------------------------------ */

const ButtonGroupSection = () => {
    const [view, setView] = useState<Set<string | number>>(new Set(["grid"]));

    return (
        <ShowcaseSection
            id="base-button-group"
            title="Button group"
            description="A segmented control built on React Aria's ToggleButtonGroup. Single selection by default; multiple selection, icons and disabled items are supported."
            importPath="base/button-group/button-group"
            exports={["ButtonGroup", "ButtonGroupItem"]}
        >
            <Demo title="Sizes (text items, single selection)" className="flex-col items-start">
                {(["sm", "md", "lg"] as const).map((size) => (
                    <Labelled key={size} label={size}>
                        <ButtonGroup size={size} defaultSelectedKeys={["1y"]} aria-label="Performance period">
                            <ButtonGroupItem id="1m">1M</ButtonGroupItem>
                            <ButtonGroupItem id="6m">6M</ButtonGroupItem>
                            <ButtonGroupItem id="1y">1Y</ButtonGroupItem>
                            <ButtonGroupItem id="5y">5Y</ButtonGroupItem>
                            <ButtonGroupItem id="max">Max</ButtonGroupItem>
                        </ButtonGroup>
                    </Labelled>
                ))}
            </Demo>
            <Demo title="Icons">
                <Labelled label="iconLeading">
                    <ButtonGroup defaultSelectedKeys={["chart"]} aria-label="Report type">
                        <ButtonGroupItem id="chart" iconLeading={BarChart01}>
                            Performance
                        </ButtonGroupItem>
                        <ButtonGroupItem id="allocation" iconLeading={PieChart01}>
                            Allocation
                        </ButtonGroupItem>
                        <ButtonGroupItem id="growth" iconLeading={TrendUp01}>
                            Growth
                        </ButtonGroupItem>
                    </ButtonGroup>
                </Labelled>
                <Labelled label="iconTrailing">
                    <ButtonGroup selectionMode="single" aria-label="Actions">
                        <ButtonGroupItem id="export" iconTrailing={Download01}>
                            Export
                        </ButtonGroupItem>
                        <ButtonGroupItem id="share" iconTrailing={ArrowUpRight}>
                            Share
                        </ButtonGroupItem>
                    </ButtonGroup>
                </Labelled>
                <Labelled label={`icon only (controlled: ${[...view].join(", ") || "none"})`}>
                    <ButtonGroup selectedKeys={view} onSelectionChange={setView} aria-label="Layout">
                        <ButtonGroupItem id="grid" iconLeading={LayoutGrid01} aria-label="Grid view" />
                        <ButtonGroupItem id="list" iconLeading={List} aria-label="List view" />
                        <ButtonGroupItem id="calendar" iconLeading={Calendar} aria-label="Calendar view" />
                    </ButtonGroup>
                </Labelled>
            </Demo>
            <Demo title="Selection and disabled">
                <Labelled label='selectionMode="multiple"'>
                    <ButtonGroup selectionMode="multiple" defaultSelectedKeys={["left", "center"]} aria-label="Alignment">
                        <ButtonGroupItem id="left" iconLeading={AlignLeft} aria-label="Align left" />
                        <ButtonGroupItem id="center" iconLeading={AlignCenter} aria-label="Align centre" />
                        <ButtonGroupItem id="right" iconLeading={AlignRight} aria-label="Align right" />
                    </ButtonGroup>
                </Labelled>
                <Labelled label="one item isDisabled">
                    <ButtonGroup defaultSelectedKeys={["za"]} aria-label="Market">
                        <ButtonGroupItem id="za">South Africa</ButtonGroupItem>
                        <ButtonGroupItem id="global">Global</ButtonGroupItem>
                        <ButtonGroupItem id="crypto" isDisabled>
                            Crypto
                        </ButtonGroupItem>
                    </ButtonGroup>
                </Labelled>
                <Labelled label="whole group isDisabled">
                    <ButtonGroup isDisabled defaultSelectedKeys={["monthly"]} aria-label="Contribution frequency">
                        <ButtonGroupItem id="monthly">Monthly</ButtonGroupItem>
                        <ButtonGroupItem id="annual">Annual</ButtonGroupItem>
                    </ButtonGroup>
                </Labelled>
            </Demo>
        </ShowcaseSection>
    );
};

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

const ColourRow = ({ label, children }: { label: string; children: ReactNode }) => (
    <Labelled label={label} className="w-full">
        <div className="flex flex-wrap items-center gap-2">{children}</div>
    </Labelled>
);

const BadgesSection = () => (
    <ShowcaseSection
        id="base-badges"
        title="Badges"
        description='Status and category labels. Three types — "pill-color", "color" (rounded square) and "modern" (white, shadowed) — in three sizes and twelve colours, with dot, icon, flag, image and button add-ons.'
        importPath="base/badges/badges"
        exports={["Badge", "BadgeWithDot", "BadgeWithIcon", "BadgeWithFlag", "BadgeWithImage", "BadgeWithButton", "BadgeIcon"]}
    >
        <Demo title="Badge · every colour" className="flex-col items-start">
            <ColourRow label='type="pill-color"'>
                {BADGE_COLORS.map((color) => (
                    <Badge key={color} type="pill-color" color={color}>
                        {BADGE_LABEL[color]}
                    </Badge>
                ))}
            </ColourRow>
            <ColourRow label='type="color"'>
                {BADGE_COLORS.map((color) => (
                    <Badge key={color} type="color" color={color}>
                        {BADGE_LABEL[color]}
                    </Badge>
                ))}
            </ColourRow>
            <ColourRow label='type="modern" (gray only)'>
                <Badge type="modern" color="gray">
                    Tax-free savings
                </Badge>
            </ColourRow>
        </Demo>

        <Demo title="Sizes" className="flex-col items-start">
            {BADGE_SIZES.map((size) => (
                <ColourRow key={size} label={`size="${size}"`}>
                    <Badge size={size} type="pill-color" color="brand">
                        Pill
                    </Badge>
                    <Badge size={size} type="color" color="brand">
                        Color
                    </Badge>
                    <Badge size={size} type="modern" color="gray">
                        Modern
                    </Badge>
                    <BadgeWithDot size={size} type="pill-color" color="success">
                        On track
                    </BadgeWithDot>
                    <BadgeWithIcon size={size} type="color" color="warning" iconLeading={InfoCircle}>
                        Rebalance
                    </BadgeWithIcon>
                    <BadgeWithButton size={size} type="modern" color="gray" buttonLabel="Remove filter">
                        Equity
                    </BadgeWithButton>
                    <BadgeIcon size={size} type="pill-color" color="brand" icon={Star01} />
                </ColourRow>
            ))}
        </Demo>

        <Demo title="BadgeWithDot · every colour" className="flex-col items-start">
            <ColourRow label='type="pill-color"'>
                {BADGE_COLORS.map((color) => (
                    <BadgeWithDot key={color} type="pill-color" color={color}>
                        {BADGE_LABEL[color]}
                    </BadgeWithDot>
                ))}
            </ColourRow>
            <ColourRow label='type="color"'>
                {BADGE_COLORS.map((color) => (
                    <BadgeWithDot key={color} type="color" color={color}>
                        {BADGE_LABEL[color]}
                    </BadgeWithDot>
                ))}
            </ColourRow>
            <ColourRow label='type="modern" (coloured dot)'>
                {BADGE_COLORS.map((color) => (
                    <BadgeWithDot key={color} type="modern" color={color}>
                        {BADGE_LABEL[color]}
                    </BadgeWithDot>
                ))}
            </ColourRow>
        </Demo>

        <Demo title="BadgeWithIcon · every colour" className="flex-col items-start">
            <ColourRow label='type="pill-color" · iconLeading'>
                {BADGE_COLORS.map((color) => (
                    <BadgeWithIcon key={color} type="pill-color" color={color} iconLeading={ArrowUpRight}>
                        {BADGE_LABEL[color]}
                    </BadgeWithIcon>
                ))}
            </ColourRow>
            <ColourRow label='type="color" · iconTrailing'>
                {BADGE_COLORS.map((color) => (
                    <BadgeWithIcon key={color} type="color" color={color} iconTrailing={ArrowRight}>
                        {BADGE_LABEL[color]}
                    </BadgeWithIcon>
                ))}
            </ColourRow>
            <ColourRow label='type="modern" (coloured icon)'>
                {BADGE_COLORS.map((color) => (
                    <BadgeWithIcon key={color} type="modern" color={color} iconLeading={CheckCircle}>
                        {BADGE_LABEL[color]}
                    </BadgeWithIcon>
                ))}
            </ColourRow>
        </Demo>

        <Demo title="BadgeWithButton · every colour" className="flex-col items-start">
            <ColourRow label='type="pill-color"'>
                {BADGE_COLORS.map((color) => (
                    <BadgeWithButton key={color} type="pill-color" color={color} buttonLabel={`Remove ${BADGE_LABEL[color]}`}>
                        {BADGE_LABEL[color]}
                    </BadgeWithButton>
                ))}
            </ColourRow>
            <ColourRow label='type="color"'>
                {BADGE_COLORS.map((color) => (
                    <BadgeWithButton key={color} type="color" color={color} buttonLabel={`Remove ${BADGE_LABEL[color]}`}>
                        {BADGE_LABEL[color]}
                    </BadgeWithButton>
                ))}
            </ColourRow>
            <ColourRow label='type="modern" · custom icon'>
                <BadgeWithButton type="modern" color="gray" icon={Plus} buttonLabel="Add to watchlist">
                    Satrix 40
                </BadgeWithButton>
            </ColourRow>
        </Demo>

        <Demo title="BadgeIcon · every colour" className="flex-col items-start">
            <ColourRow label='type="pill-color"'>
                {BADGE_COLORS.map((color) => (
                    <BadgeIcon key={color} type="pill-color" color={color} icon={Zap} />
                ))}
            </ColourRow>
            <ColourRow label='type="color"'>
                {BADGE_COLORS.map((color) => (
                    <BadgeIcon key={color} type="color" color={color} icon={ShieldTick} />
                ))}
            </ColourRow>
            <ColourRow label='type="modern"'>
                <BadgeIcon type="modern" color="gray" icon={Briefcase01} />
            </ColourRow>
        </Demo>

        <Demo title="BadgeWithImage and BadgeWithFlag" className="flex-col items-start">
            <ColourRow label="BadgeWithImage (imgSrc) · pill-color / color / modern">
                {BADGE_COLORS.slice(0, 6).map((color, i) => (
                    <BadgeWithImage key={color} type="pill-color" color={color} imgSrc={PEOPLE[i % PEOPLE.length].src}>
                        {PEOPLE[i % PEOPLE.length].name.split(" ")[0]}
                    </BadgeWithImage>
                ))}
                <BadgeWithImage type="color" color="brand" imgSrc={PEOPLE[0].src}>
                    Thandi
                </BadgeWithImage>
                <BadgeWithImage type="modern" color="gray" imgSrc={PEOPLE[1].src}>
                    Pieter
                </BadgeWithImage>
            </ColourRow>
            <ColourRow label="BadgeWithFlag (flag images load from untitledui.com)">
                <BadgeWithFlag type="pill-color" color="success" flag="ZA">
                    South Africa
                </BadgeWithFlag>
                <BadgeWithFlag type="color" color="blue" flag="GB">
                    United Kingdom
                </BadgeWithFlag>
                <BadgeWithFlag type="modern" color="gray" flag="US">
                    United States
                </BadgeWithFlag>
                <BadgeWithFlag type="pill-color" color="gray" flag="earth" size="sm">
                    Global
                </BadgeWithFlag>
                <BadgeWithFlag type="pill-color" color="brand" flag="NA" size="lg">
                    Namibia
                </BadgeWithFlag>
            </ColourRow>
        </Demo>
    </ShowcaseSection>
);

const BadgeGroupsSection = () => (
    <ShowcaseSection
        id="base-badge-groups"
        title="Badge groups"
        description="An announcement pill: a small addon badge paired with a message. Light and modern themes, leading or trailing addon, five colours, two sizes."
        importPath="base/badges/badge-groups"
        exports={["BadgeGroup"]}
    >
        {(["light", "modern"] as const).map((theme) =>
            (["leading", "trailing"] as const).map((align) => (
                <Demo key={`${theme}-${align}`} title={`theme="${theme}" · align="${align}"`} className="flex-col items-start">
                    {(["brand", "gray", "error", "warning", "success"] as const).map((color) => (
                        <div key={color} className="flex flex-wrap items-center gap-3">
                            <BadgeGroup theme={theme} align={align} color={color} size="md" addonText={align === "leading" ? "New" : "Read more"}>
                                Two-pot retirement guide now live
                            </BadgeGroup>
                            <BadgeGroup theme={theme} align={align} color={color} size="lg" addonText={align === "leading" ? "Budget 2026" : "View"}>
                                Tax tables updated
                            </BadgeGroup>
                            <span className="font-mono text-xs text-quaternary">{color} · md / lg</span>
                        </div>
                    ))}
                </Demo>
            )),
        )}
        <Demo title="Addon only, custom trailing icon">
            <Labelled label="no children">
                <BadgeGroup color="brand" addonText="Beta" />
            </Labelled>
            <Labelled label="iconTrailing={Mail01}">
                <BadgeGroup color="success" addonText="Inbox" iconTrailing={Mail01}>
                    3 new client messages
                </BadgeGroup>
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------ */
/* Avatars                                                             */
/* ------------------------------------------------------------------ */

const AvatarsSection = () => (
    <ShowcaseSection
        id="base-avatars"
        title="Avatars"
        description="People and organisations. Six sizes; an image, initials or a placeholder icon; and one indicator at a time — online status, verified tick, unread count or a company badge."
        importPath="base/avatar/avatar"
        exports={["Avatar"]}
    >
        <Demo title="Sizes · image / initials / placeholder" className="flex-col items-start">
            <Labelled label="src (image)">
                <div className="flex items-end gap-3">
                    {AVATAR_SIZES.map((size, i) => (
                        <Avatar key={size} size={size} src={PEOPLE[i % PEOPLE.length].src} alt={PEOPLE[i % PEOPLE.length].name} />
                    ))}
                </div>
            </Labelled>
            <Labelled label="initials">
                <div className="flex items-end gap-3">
                    {AVATAR_SIZES.map((size) => (
                        <Avatar key={size} size={size} initials={getInitials("Aisha Naidoo")} />
                    ))}
                </div>
            </Labelled>
            <Labelled label="placeholder (default icon)">
                <div className="flex items-end gap-3">
                    {AVATAR_SIZES.map((size) => (
                        <Avatar key={size} size={size} />
                    ))}
                </div>
            </Labelled>
            <Labelled label="placeholderIcon={Building07}">
                <div className="flex items-end gap-3">
                    {AVATAR_SIZES.map((size) => (
                        <Avatar key={size} size={size} placeholderIcon={Building07} />
                    ))}
                </div>
            </Labelled>
        </Demo>

        <Demo title="Indicators, every size" className="flex-col items-start">
            <Labelled label='status="online"'>
                <div className="flex items-end gap-3">
                    {AVATAR_SIZES.map((size) => (
                        <Avatar key={size} size={size} src={PEOPLE[0].src} alt={PEOPLE[0].name} status="online" />
                    ))}
                </div>
            </Labelled>
            <Labelled label='status="offline"'>
                <div className="flex items-end gap-3">
                    {AVATAR_SIZES.map((size) => (
                        <Avatar key={size} size={size} initials="PW" status="offline" />
                    ))}
                </div>
            </Labelled>
            <Labelled label="verified">
                <div className="flex items-end gap-3">
                    {AVATAR_SIZES.map((size) => (
                        <Avatar key={size} size={size} src={PEOPLE[1].src} alt={PEOPLE[1].name} verified />
                    ))}
                </div>
            </Labelled>
            <Labelled label="count">
                <div className="flex items-end gap-3">
                    {AVATAR_SIZES.map((size) => (
                        <Avatar key={size} size={size} src={PEOPLE[2].src} alt={PEOPLE[2].name} count={3} />
                    ))}
                </div>
            </Labelled>
            <Labelled label="badge={<AvatarCompanyIcon />}">
                <div className="flex items-end gap-3">
                    {AVATAR_SIZES.map((size) => (
                        <Avatar
                            key={size}
                            size={size}
                            src={PEOPLE[3].src}
                            alt={PEOPLE[3].name}
                            badge={<AvatarCompanyIcon size={size} src={COMPANY_ICON} alt="Navigate Wealth" />}
                        />
                    ))}
                </div>
            </Labelled>
        </Demo>

        <Demo title="Shape and border">
            <Labelled label="border">
                <Avatar size="lg" src={PEOPLE[4].src} alt={PEOPLE[4].name} border />
            </Labelled>
            <Labelled label="contrastBorder">
                <Avatar size="lg" src={PEOPLE[4].src} alt={PEOPLE[4].name} contrastBorder />
            </Labelled>
            <Labelled label="rounded={false}">
                <Avatar size="lg" rounded={false} src={COMPANY_ICON} alt="Navigate Wealth" />
            </Labelled>
            <Labelled label="rounded={false} · initials">
                <Avatar size="lg" rounded={false} initials="NW" />
            </Labelled>
            <Labelled label="focusable (inside a link)">
                <a href="#base-avatars" className="group rounded-full outline-hidden">
                    <Avatar size="lg" src={PEOPLE[0].src} alt={PEOPLE[0].name} focusable />
                </a>
            </Labelled>
            <Labelled label="broken src falls back to initials">
                <Avatar size="lg" src="data:image/png;base64,broken" initials="SD" alt="Sipho Dlamini" />
            </Labelled>
        </Demo>

        <Demo title="Avatar group (stack) · composed from Avatar + AvatarAddButton" className="flex-col items-start">
            {(["xs", "sm", "md"] as const).map((size) => (
                <Labelled key={size} label={size}>
                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                            {PEOPLE.map((person) => (
                                <Avatar key={person.name} size={size} src={person.src} alt={person.name} className="ring-[1.5px] ring-bg-primary" />
                            ))}
                            <Avatar size={size} initials="+8" className="ring-[1.5px] ring-bg-primary" />
                        </div>
                        <AvatarAddButton size={size} title="Add adviser to household" />
                    </div>
                </Labelled>
            ))}
        </Demo>
    </ShowcaseSection>
);

const AvatarLabelGroupSection = () => (
    <ShowcaseSection
        id="base-avatar-label-group"
        title="Avatar label group"
        description="An avatar with a name and a supporting line, for adviser cards, table rows and account menus. Accepts every Avatar prop."
        importPath="base/avatar/avatar-label-group"
        exports={["AvatarLabelGroup"]}
    >
        <Demo title="Sizes" className="grid gap-6 sm:grid-cols-3">
            {(["sm", "md", "lg"] as const).map((size, i) => (
                <Labelled key={size} label={size}>
                    <AvatarLabelGroup size={size} src={PEOPLE[i].src} alt={PEOPLE[i].name} title={PEOPLE[i].name} subtitle={PEOPLE[i].role} />
                </Labelled>
            ))}
        </Demo>
        <Demo title="With avatar options" className="grid gap-6 sm:grid-cols-3">
            <Labelled label="status online">
                <AvatarLabelGroup size="md" src={PEOPLE[0].src} status="online" title="Thandi Mokoena" subtitle="Available for calls" />
            </Labelled>
            <Labelled label="initials + verified">
                <AvatarLabelGroup size="md" initials="AN" verified title="Aisha Naidoo" subtitle="FICA verified · R 1 250 000" />
            </Labelled>
            <Labelled label="rounded={false} · placeholder icon">
                <AvatarLabelGroup size="md" rounded={false} placeholderIcon={Building07} title="Mokoena Family Trust" subtitle="3 portfolios" />
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

const AvatarProfilePhotoSection = () => (
    <ShowcaseSection
        id="base-avatar-profile-photo"
        title="Avatar profile photo"
        description="The large framed avatar for profile headers, in three sizes with image, initials or placeholder and a verified tick, status or badge."
        importPath="base/avatar/avatar-profile-photo"
        exports={["AvatarProfilePhoto"]}
    >
        <Demo title="Sizes · image / initials / placeholder" className="items-end pb-12">
            {(["sm", "md", "lg"] as const).map((size) => (
                <Labelled key={`img-${size}`} label={`${size} · src`}>
                    <AvatarProfilePhoto size={size} src={PEOPLE[0].src} alt={PEOPLE[0].name} />
                </Labelled>
            ))}
            <Labelled label="md · initials">
                <AvatarProfilePhoto size="md" initials="PW" />
            </Labelled>
            <Labelled label="md · placeholder">
                <AvatarProfilePhoto size="md" />
            </Labelled>
            <Labelled label="md · placeholderIcon">
                <AvatarProfilePhoto size="md" placeholderIcon={Users01} />
            </Labelled>
        </Demo>
        <Demo title="Indicators" className="items-end pb-12">
            {(["sm", "md", "lg"] as const).map((size) => (
                <Labelled key={`v-${size}`} label={`${size} · verified`}>
                    <AvatarProfilePhoto size={size} src={PEOPLE[1].src} alt={PEOPLE[1].name} verified />
                </Labelled>
            ))}
            <Labelled label='md · status="online"'>
                <AvatarProfilePhoto size="md" src={PEOPLE[2].src} alt={PEOPLE[2].name} status="online" />
            </Labelled>
            <Labelled label='md · status="offline"'>
                <AvatarProfilePhoto size="md" initials="SD" status="offline" />
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

const AvatarPartsSection = () => (
    <ShowcaseSection
        id="base-avatar-parts"
        title="Avatar building blocks"
        description="The pieces Avatar composes, exported for custom layouts: add button, company icon, count, online indicator and verified tick."
        importPath="base/avatar/base-components"
        exports={["AvatarAddButton", "AvatarCompanyIcon", "AvatarOnlineIndicator", "VerifiedTick"]}
    >
        <Demo title="AvatarAddButton (with tooltip)">
            {(["xs", "sm", "md"] as const).map((size) => (
                <Labelled key={size} label={size}>
                    <AvatarAddButton size={size} title="Add team member" />
                </Labelled>
            ))}
            <Labelled label="isDisabled">
                <AvatarAddButton size="md" isDisabled />
            </Labelled>
        </Demo>
        <Demo title="AvatarOnlineIndicator · every size">
            {(["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"] as const).map((size) => (
                <Labelled key={size} label={size}>
                    <div className="flex gap-2">
                        <span className="relative inline-block size-5">
                            <AvatarOnlineIndicator size={size} status="online" />
                        </span>
                        <span className="relative inline-block size-5">
                            <AvatarOnlineIndicator size={size} status="offline" />
                        </span>
                    </div>
                </Labelled>
            ))}
        </Demo>
        <Demo title="VerifiedTick · every size">
            {(["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"] as const).map((size) => (
                <Labelled key={size} label={size}>
                    <VerifiedTick size={size} />
                </Labelled>
            ))}
        </Demo>
        <Demo title="AvatarCompanyIcon and AvatarCount (positioned on an avatar-sized box)">
            {(["xs", "sm", "md", "lg", "xl", "2xl"] as const).map((size) => (
                <Labelled key={size} label={`AvatarCompanyIcon ${size}`}>
                    <span className="relative inline-flex size-10 rounded-full bg-tertiary">
                        <AvatarCompanyIcon size={size} src={COMPANY_ICON} alt="Navigate Wealth" />
                    </span>
                </Labelled>
            ))}
            <Labelled label="AvatarCount (base-components/avatar-count)">
                <span className="relative inline-flex size-10 rounded-full bg-tertiary">
                    <AvatarCount count={5} />
                </span>
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------ */
/* Tags                                                                */
/* ------------------------------------------------------------------ */

const TagsSection = () => {
    const [filters, setFilters] = useState([
        { id: "equity", label: "Local equity", count: 12 },
        { id: "bonds", label: "Bonds", count: 4 },
        { id: "offshore", label: "Offshore", count: 7 },
        { id: "property", label: "Listed property", count: 2 },
    ]);

    return (
        <ShowcaseSection
            id="base-tags"
            title="Tags"
            description="Filters and selections built on React Aria's TagGroup. Three sizes; leading avatar or dot; count; a remove button; and single or multiple selection with a checkbox."
            importPath="base/tags/tags"
            exports={["TagGroup", "TagList", "Tag", "TagAvatar"]}
        >
            <Demo title="Sizes · plain, dot, avatar, count, disabled" className="flex-col items-start">
                {(["sm", "md", "lg"] as const).map((size) => (
                    <Labelled key={size} label={size}>
                        <TagGroup label={`Tags ${size}`} size={size}>
                            <TagList className="flex flex-wrap gap-2">
                                <Tag id="plain">Retirement annuity</Tag>
                                <Tag id="dot" dot>
                                    Active
                                </Tag>
                                <Tag id="dot-custom" dot dotClassName="text-fg-warning-secondary">
                                    Review due
                                </Tag>
                                <Tag id="avatar" avatarSrc={PEOPLE[0].src}>
                                    Thandi Mokoena
                                </Tag>
                                <Tag id="count" count={8}>
                                    Unit trusts
                                </Tag>
                                <Tag id="disabled" isDisabled>
                                    Closed
                                </Tag>
                            </TagList>
                        </TagGroup>
                    </Labelled>
                ))}
            </Demo>

            <Demo title="Removable (onRemove shows the close X)" className="flex-col items-start">
                <TagGroup label="Active filters" size="md" onRemove={(keys) => setFilters((current) => current.filter((item) => !keys.has(item.id)))}>
                    <TagList
                        className="flex flex-wrap gap-2"
                        items={filters}
                        renderEmptyState={() => <span className="text-sm text-tertiary">All filters cleared.</span>}
                    >
                        {(item) => (
                            <Tag id={item.id} count={item.count}>
                                {item.label}
                            </Tag>
                        )}
                    </TagList>
                </TagGroup>
                <Button
                    size="xs"
                    color="link-color"
                    onPress={() =>
                        setFilters([
                            { id: "equity", label: "Local equity", count: 12 },
                            { id: "bonds", label: "Bonds", count: 4 },
                            { id: "offshore", label: "Offshore", count: 7 },
                            { id: "property", label: "Listed property", count: 2 },
                        ])
                    }
                >
                    Reset filters
                </Button>
            </Demo>

            <Demo title="Selection (checkbox appears)" className="flex-col items-start">
                {(["sm", "md", "lg"] as const).map((size) => (
                    <Labelled key={size} label={`selectionMode="multiple" · ${size}`}>
                        <TagGroup label={`Asset classes ${size}`} size={size} selectionMode="multiple" defaultSelectedKeys={["equity", "offshore"]}>
                            <TagList className="flex flex-wrap gap-2">
                                <Tag id="equity">Equity</Tag>
                                <Tag id="bonds">Bonds</Tag>
                                <Tag id="offshore" dot>
                                    Offshore
                                </Tag>
                                <Tag id="cash" count={2}>
                                    Cash
                                </Tag>
                                <Tag id="crypto" isDisabled>
                                    Crypto
                                </Tag>
                            </TagList>
                        </TagGroup>
                    </Labelled>
                ))}
                <Labelled label='selectionMode="single"'>
                    <TagGroup label="Risk profile" size="md" selectionMode="single" defaultSelectedKeys={["moderate"]}>
                        <TagList className="flex flex-wrap gap-2">
                            <Tag id="conservative">Conservative</Tag>
                            <Tag id="moderate">Moderate</Tag>
                            <Tag id="aggressive">Aggressive</Tag>
                        </TagList>
                    </TagGroup>
                </Labelled>
            </Demo>

            <Demo title="Building blocks: TagAvatar, TagCheckbox, TagCloseX">
                <Labelled label="TagAvatar (src / fallback / no contrast border)">
                    <div className="flex items-center gap-2">
                        <TagAvatar src={PEOPLE[1].src} alt="Pieter van Wyk" />
                        <TagAvatar />
                        <TagAvatar src={PEOPLE[2].src} alt="Aisha Naidoo" contrastBorder={false} />
                    </div>
                </Labelled>
                {(["sm", "md", "lg"] as const).map((size) => (
                    <Labelled key={size} label={`TagCheckbox ${size}`}>
                        <div className="flex items-center gap-2">
                            <TagCheckbox size={size} />
                            <TagCheckbox size={size} isSelected />
                            <TagCheckbox size={size} isDisabled />
                            <TagCheckbox size={size} isSelected isDisabled />
                        </div>
                    </Labelled>
                ))}
                <Labelled label="TagCheckbox isFocused">
                    <TagCheckbox size="md" isFocused />
                </Labelled>
                <Labelled label="TagCloseX sm / md / lg">
                    <div className="flex items-center gap-2">
                        <TagCloseX size="sm" slot={null} />
                        <TagCloseX size="md" slot={null} />
                        <TagCloseX size="lg" slot={null} />
                    </div>
                </Labelled>
            </Demo>
        </ShowcaseSection>
    );
};

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

const TooltipSection = () => (
    <ShowcaseSection
        id="base-tooltips"
        title="Tooltips"
        description="Short explanations on hover or focus. A title, optional supporting text, optional arrow, and any React Aria placement."
        importPath="base/tooltip/tooltip"
        exports={["Tooltip", "TooltipTrigger"]}
    >
        <Demo title="Variants (hover or focus the icons)" className="gap-8">
            <Labelled label="title only">
                <Tooltip title="Total assets under advice">
                    <TooltipTrigger aria-label="What is AUA?">
                        <HelpCircle className="size-5 text-fg-quaternary" />
                    </TooltipTrigger>
                </Tooltip>
            </Labelled>
            <Labelled label="title + arrow">
                <Tooltip title="Includes offshore holdings" arrow>
                    <TooltipTrigger aria-label="About this figure">
                        <InfoCircle className="size-5 text-fg-quaternary" />
                    </TooltipTrigger>
                </Tooltip>
            </Labelled>
            <Labelled label="title + description">
                <Tooltip title="Regulation 28" description="Limits offshore exposure in retirement funds to 45% of the portfolio.">
                    <TooltipTrigger aria-label="What is Regulation 28?">
                        <HelpCircle className="size-5 text-fg-quaternary" />
                    </TooltipTrigger>
                </Tooltip>
            </Labelled>
            <Labelled label="title + description + arrow">
                <Tooltip title="Annual allowance" description="R 36 000 per tax year into a tax-free savings account." arrow>
                    <TooltipTrigger aria-label="Tax-free allowance">
                        <InfoCircle className="size-5 text-fg-quaternary" />
                    </TooltipTrigger>
                </Tooltip>
            </Labelled>
            <Labelled label="on a Button">
                <Tooltip title="Download the quarterly statement" arrow>
                    <Button color="secondary" size="sm" iconLeading={Download01}>
                        Statement
                    </Button>
                </Tooltip>
            </Labelled>
            <Labelled label="isDisabled">
                <Tooltip title="Never shown" isDisabled>
                    <TooltipTrigger aria-label="Disabled tooltip">
                        <HelpCircle className="text-fg-disabled size-5" />
                    </TooltipTrigger>
                </Tooltip>
            </Labelled>
        </Demo>

        <Demo title="Placements (hover)" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(["top", "top start", "top end", "bottom", "bottom start", "bottom end", "left", "right"] as const).map((placement) => (
                <Tooltip key={placement} title={`placement="${placement}"`} placement={placement} arrow>
                    <Button color="secondary" size="sm" className="w-full">
                        {placement}
                    </Button>
                </Tooltip>
            ))}
        </Demo>

        <HeldOpenTooltips />
    </ShowcaseSection>
);

/**
 * Controlled tooltips (isOpen). They start closed and open together from a
 * button: an open React Aria tooltip claims the Escape key for the whole page,
 * so tooltips held open from page load would stop Escape closing any modal.
 */
const HeldOpenTooltips = () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <Demo title="Held open (isOpen)" className="flex-col items-stretch gap-6">
            <div>
                <Button color="secondary" size="sm" onPress={() => setIsOpen((open) => !open)}>
                    {isOpen ? "Close the tooltips" : "Open all three tooltips"}
                </Button>
            </div>
            <div className="flex justify-around gap-x-8 pt-28 pb-10">
                <Tooltip title="Portfolio value" isOpen={isOpen} onOpenChange={setIsOpen}>
                    <TooltipTrigger aria-label="Portfolio value">
                        <Wallet02 className="size-5 text-fg-quaternary" />
                    </TooltipTrigger>
                </Tooltip>
                <Tooltip title="Portfolio value" arrow isOpen={isOpen} onOpenChange={setIsOpen}>
                    <TooltipTrigger aria-label="Portfolio value with arrow">
                        <Wallet02 className="size-5 text-fg-quaternary" />
                    </TooltipTrigger>
                </Tooltip>
                <Tooltip
                    title="R 1 250 000"
                    description="Balanced Growth, as at 31 August 2026. Up 8.4% over twelve months."
                    arrow
                    isOpen={isOpen}
                    onOpenChange={setIsOpen}
                >
                    <TooltipTrigger aria-label="Portfolio detail">
                        <Grid01 className="size-5 text-fg-quaternary" />
                    </TooltipTrigger>
                </Tooltip>
            </div>
        </Demo>
    );
};

/* ------------------------------------------------------------------ */
/* Selection controls                                                  */
/* ------------------------------------------------------------------ */

const ToggleSection = () => (
    <ShowcaseSection
        id="base-toggles"
        title="Toggles"
        description="An on/off switch built on React Aria's Switch. Two sizes, a slim variant, optional label and hint."
        importPath="base/toggle/toggle"
        exports={["Toggle", "ToggleBase"]}
    >
        {(["sm", "md"] as const).map((size) => (
            <Demo key={size} title={`size="${size}"`} className="gap-8">
                <Labelled label="off">
                    <Toggle size={size} aria-label="Off" />
                </Labelled>
                <Labelled label="on">
                    <Toggle size={size} defaultSelected aria-label="On" />
                </Labelled>
                <Labelled label="disabled">
                    <div className="flex gap-3">
                        <Toggle size={size} isDisabled aria-label="Disabled off" />
                        <Toggle size={size} isDisabled defaultSelected aria-label="Disabled on" />
                    </div>
                </Labelled>
                <Labelled label="slim">
                    <div className="flex gap-3">
                        <Toggle size={size} slim aria-label="Slim off" />
                        <Toggle size={size} slim defaultSelected aria-label="Slim on" />
                    </div>
                </Labelled>
                <Labelled label="label + hint">
                    <Toggle size={size} defaultSelected label="Email statements" hint="Monthly statements go to your registered address." />
                </Labelled>
                <Labelled label="slim · label + hint">
                    <Toggle size={size} slim label="Two-factor sign-in" hint="Required for withdrawals over R 50 000." />
                </Labelled>
            </Demo>
        ))}
        <Demo title="ToggleBase (visual only, for custom controls)">
            {(["sm", "md"] as const).map((size) => (
                <Labelled key={size} label={`${size}: off / on / hovered / focus / disabled / slim on`}>
                    <div className="flex gap-3">
                        <ToggleBase size={size} />
                        <ToggleBase size={size} isSelected />
                        <ToggleBase size={size} isSelected isHovered />
                        <ToggleBase size={size} isFocusVisible />
                        <ToggleBase size={size} isDisabled />
                        <ToggleBase size={size} slim isSelected />
                    </div>
                </Labelled>
            ))}
        </Demo>
    </ShowcaseSection>
);

const CheckboxSection = () => (
    <ShowcaseSection
        id="base-checkboxes"
        title="Checkboxes"
        description="Built on React Aria's Checkbox. Two sizes; checked, indeterminate and disabled states; optional label and hint."
        importPath="base/checkbox/checkbox"
        exports={["Checkbox", "CheckboxBase"]}
    >
        {(["sm", "md"] as const).map((size) => (
            <Demo key={size} title={`size="${size}"`} className="gap-8">
                <Labelled label="unchecked">
                    <Checkbox size={size} aria-label="Unchecked" />
                </Labelled>
                <Labelled label="checked">
                    <Checkbox size={size} defaultSelected aria-label="Checked" />
                </Labelled>
                <Labelled label="indeterminate">
                    <Checkbox size={size} isIndeterminate aria-label="Indeterminate" />
                </Labelled>
                <Labelled label="disabled (off / on / indeterminate)">
                    <div className="flex gap-3">
                        <Checkbox size={size} isDisabled aria-label="Disabled" />
                        <Checkbox size={size} isDisabled defaultSelected aria-label="Disabled checked" />
                        <Checkbox size={size} isDisabled isIndeterminate aria-label="Disabled indeterminate" />
                    </div>
                </Labelled>
                <Labelled label="label">
                    <Checkbox size={size} label="Remember this device" />
                </Labelled>
                <Labelled label="label + hint">
                    <Checkbox
                        size={size}
                        defaultSelected
                        label="I accept the record of advice"
                        hint="Your adviser will keep a signed copy on file for five years."
                    />
                </Labelled>
            </Demo>
        ))}
        <Demo title="CheckboxBase (visual only)">
            {(["sm", "md"] as const).map((size) => (
                <Labelled key={size} label={`${size}: off / on / indeterminate / focus / disabled`}>
                    <div className="flex gap-3">
                        <CheckboxBase size={size} />
                        <CheckboxBase size={size} isSelected />
                        <CheckboxBase size={size} isIndeterminate />
                        <CheckboxBase size={size} isFocusVisible />
                        <CheckboxBase size={size} isDisabled />
                    </div>
                </Labelled>
            ))}
        </Demo>
    </ShowcaseSection>
);

const RadioSection = () => (
    <ShowcaseSection
        id="base-radio-buttons"
        title="Radio buttons"
        description="Single choice from a set, built on React Aria's RadioGroup. Two sizes, labels with hints, and disabled options or groups."
        importPath="base/radio-buttons/radio-buttons"
        exports={["RadioGroup", "RadioButton", "RadioButtonBase"]}
    >
        <Demo title="RadioGroup · sizes, labels and hints" className="grid items-start gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {(["sm", "md"] as const).map((size) => (
                <Labelled key={size} label={`size="${size}"`}>
                    <RadioGroup size={size} aria-label={`Risk profile (${size})`} defaultValue="moderate">
                        <RadioButton value="conservative" label="Conservative" hint="Capital preservation, mostly cash and bonds." />
                        <RadioButton value="moderate" label="Moderate" hint="A balance of growth and stability." />
                        <RadioButton value="aggressive" label="Aggressive" hint="Long-term growth, higher volatility." />
                        <RadioButton value="bespoke" label="Bespoke" hint="Not available for this product." isDisabled />
                    </RadioGroup>
                </Labelled>
            ))}
            <Labelled label="labels only · whole group isDisabled">
                <RadioGroup aria-label="Contribution frequency" defaultValue="monthly" isDisabled>
                    <RadioButton value="monthly" label="Monthly debit order" />
                    <RadioButton value="annual" label="Annual lump sum" />
                </RadioGroup>
            </Labelled>
        </Demo>
        <Demo title="Horizontal group, no labels">
            <RadioGroup aria-label="Rating" orientation="horizontal" className="flex-row" defaultValue="3">
                {["1", "2", "3", "4", "5"].map((value) => (
                    <RadioButton key={value} value={value} aria-label={`${value} of 5`} />
                ))}
            </RadioGroup>
        </Demo>
        <Demo title="RadioButtonBase (visual only)">
            {(["sm", "md"] as const).map((size) => (
                <Labelled key={size} label={`${size}: off / on / focus / disabled / disabled on`}>
                    <div className="flex gap-3">
                        <RadioButtonBase size={size} />
                        <RadioButtonBase size={size} isSelected />
                        <RadioButtonBase size={size} isFocusVisible />
                        <RadioButtonBase size={size} isDisabled />
                        <RadioButtonBase size={size} isDisabled isSelected />
                    </div>
                </Labelled>
            ))}
        </Demo>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------ */
/* Slider                                                              */
/* ------------------------------------------------------------------ */

const rand = (value: number) => `R ${value.toLocaleString("en-ZA").replace(/,/g, " ")}`;

const SliderSection = () => {
    const [contribution, setContribution] = useState(2500);

    return (
        <ShowcaseSection
            id="base-sliders"
            title="Sliders"
            description="Pick a value or a range on a track, built on React Aria's Slider. The thumb label can be hidden, shown below, or float above; values are percentages by default and can be formatted."
            importPath="base/slider/slider"
            exports={["Slider"]}
        >
            <Demo title="Single value" className="grid gap-x-10 gap-y-14 pb-12 sm:grid-cols-3">
                <Labelled label='labelPosition="default" (no label)'>
                    <Slider aria-label="Equity allocation" defaultValue={60} />
                </Labelled>
                <Labelled label='labelPosition="bottom"'>
                    <Slider aria-label="Equity allocation" defaultValue={45} labelPosition="bottom" />
                </Labelled>
                <Labelled label='labelPosition="top-floating"'>
                    <div className="pt-10">
                        <Slider aria-label="Offshore exposure" defaultValue={30} labelPosition="top-floating" />
                    </div>
                </Labelled>
            </Demo>
            <Demo title="Range (two thumbs)" className="grid gap-x-10 gap-y-14 pb-12 sm:grid-cols-3">
                <Labelled label="default">
                    <Slider aria-label="Target band" defaultValue={[25, 75]} />
                </Labelled>
                <Labelled label="bottom">
                    <Slider aria-label="Target band" defaultValue={[20, 60]} labelPosition="bottom" />
                </Labelled>
                <Labelled label="top-floating">
                    <div className="pt-10">
                        <Slider aria-label="Target band" defaultValue={[40, 80]} labelPosition="top-floating" />
                    </div>
                </Labelled>
            </Demo>
            <Demo title="Custom range and formatter" className="grid gap-x-10 gap-y-14 pb-12 sm:grid-cols-2">
                <Labelled label={`controlled · labelFormatter (${rand(contribution)} a month)`}>
                    <div className="pt-10">
                        <Slider
                            aria-label="Monthly contribution"
                            minValue={500}
                            maxValue={10000}
                            step={250}
                            value={contribution}
                            onChange={(value) => setContribution(value as number)}
                            labelPosition="top-floating"
                            labelFormatter={rand}
                        />
                    </div>
                </Labelled>
                <Labelled label="range · years · isDisabled">
                    <Slider
                        aria-label="Investment horizon"
                        minValue={0}
                        maxValue={40}
                        defaultValue={[5, 25]}
                        labelPosition="bottom"
                        labelFormatter={(value) => `${value} yrs`}
                        isDisabled
                    />
                </Labelled>
            </Demo>
        </ShowcaseSection>
    );
};

/* ------------------------------------------------------------------ */
/* Progress indicators                                                 */
/* ------------------------------------------------------------------ */

const ProgressBarsSection = () => (
    <ShowcaseSection
        id="base-progress-bars"
        title="Progress bars"
        description="Linear progress with the value shown to the right, below, or in a floating label above or below the fill."
        importPath="base/progress-indicators/progress-indicators"
        exports={["ProgressBar", "ProgressBarBase"]}
    >
        <Demo title="Label placements" className="grid gap-x-10 gap-y-12 pt-14 pb-14 sm:grid-cols-2">
            <Labelled label="ProgressBarBase (no label)">
                <ProgressBarBase value={40} />
            </Labelled>
            <Labelled label='labelPosition="right"'>
                <ProgressBar value={62} labelPosition="right" />
            </Labelled>
            <Labelled label='labelPosition="bottom"'>
                <ProgressBar value={75} labelPosition="bottom" />
            </Labelled>
            <Labelled label='labelPosition="top-floating"'>
                <div className="pt-10">
                    <ProgressBar value={33} labelPosition="top-floating" />
                </div>
            </Labelled>
            <Labelled label='labelPosition="bottom-floating"'>
                <ProgressBar value={88} labelPosition="bottom-floating" />
            </Labelled>
            <Labelled label="min / max + valueFormatter">
                <ProgressBar
                    value={850000}
                    min={0}
                    max={1250000}
                    labelPosition="right"
                    valueFormatter={(value, percent) => `${rand(value)} of R 1 250 000 (${percent.toFixed(0)}%)`}
                />
            </Labelled>
        </Demo>
        <Demo title="Custom colours (progressClassName)" className="grid gap-6 sm:grid-cols-3">
            <Labelled label="success">
                <ProgressBar value={100} labelPosition="right" progressClassName="bg-fg-success-secondary" />
            </Labelled>
            <Labelled label="warning">
                <ProgressBar value={55} labelPosition="right" progressClassName="bg-fg-warning-secondary" />
            </Labelled>
            <Labelled label="error">
                <ProgressBar value={15} labelPosition="right" progressClassName="bg-fg-error-secondary" />
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

const PROGRESS_CIRCLE_SIZES = ["xxs", "xs", "sm", "md", "lg"] as const;

const ProgressCirclesSection = () => (
    <ShowcaseSection
        id="base-progress-circles"
        title="Progress circles"
        description="Circular and half-circle gauges in five sizes, with an optional label, plus a compact simple circle."
        importPath="base/progress-indicators/progress-circles"
        exports={["ProgressBarCircle", "ProgressBarHalfCircle"]}
    >
        <Demo title="ProgressBarCircle · every size" className="items-end gap-8">
            {PROGRESS_CIRCLE_SIZES.map((size) => (
                <Labelled key={size} label={size}>
                    <ProgressBarCircle size={size} value={72} label="Goal reached" />
                </Labelled>
            ))}
        </Demo>
        <Demo title="ProgressBarHalfCircle · every size" className="items-end gap-8">
            {PROGRESS_CIRCLE_SIZES.map((size) => (
                <Labelled key={size} label={size}>
                    <ProgressBarHalfCircle size={size} value={45} label="Funded" />
                </Labelled>
            ))}
        </Demo>
        <Demo title="Without label · custom formatter" className="items-end gap-8">
            <Labelled label="circle, no label">
                <ProgressBarCircle size="xs" value={30} />
            </Labelled>
            <Labelled label="half circle, no label">
                <ProgressBarHalfCircle size="xs" value={90} />
            </Labelled>
            <Labelled label="valueFormatter">
                <ProgressBarCircle size="xs" value={3} min={0} max={5} valueFormatter={(value, percent) => `${value}/5 · ${percent.toFixed(0)}%`} />
            </Labelled>
        </Demo>
        <Demo title="CircleProgressBar (simple-circle.tsx)">
            {[0, 25, 60, 100].map((value) => (
                <Labelled key={value} label={`value={${value}}`}>
                    <CircleProgressBar value={value} />
                </Labelled>
            ))}
        </Demo>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------ */
/* Group                                                               */
/* ------------------------------------------------------------------ */

const SECTIONS = [
    { id: "base-buttons", title: "Buttons", Component: ButtonsSection },
    { id: "base-button-utility", title: "Utility buttons", Component: ButtonUtilitySection },
    { id: "base-close-button", title: "Close button", Component: CloseButtonSection },
    { id: "base-social-buttons", title: "Social buttons", Component: SocialButtonsSection },
    { id: "base-app-store-buttons", title: "App store buttons", Component: AppStoreButtonsSection },
    { id: "base-button-group", title: "Button group", Component: ButtonGroupSection },
    { id: "base-badges", title: "Badges", Component: BadgesSection },
    { id: "base-badge-groups", title: "Badge groups", Component: BadgeGroupsSection },
    { id: "base-avatars", title: "Avatars", Component: AvatarsSection },
    { id: "base-avatar-label-group", title: "Avatar label group", Component: AvatarLabelGroupSection },
    { id: "base-avatar-profile-photo", title: "Avatar profile photo", Component: AvatarProfilePhotoSection },
    { id: "base-avatar-parts", title: "Avatar building blocks", Component: AvatarPartsSection },
    { id: "base-tags", title: "Tags", Component: TagsSection },
    { id: "base-tooltips", title: "Tooltips", Component: TooltipSection },
    { id: "base-toggles", title: "Toggles", Component: ToggleSection },
    { id: "base-checkboxes", title: "Checkboxes", Component: CheckboxSection },
    { id: "base-radio-buttons", title: "Radio buttons", Component: RadioSection },
    { id: "base-sliders", title: "Sliders", Component: SliderSection },
    { id: "base-progress-bars", title: "Progress bars", Component: ProgressBarsSection },
    { id: "base-progress-circles", title: "Progress circles", Component: ProgressCirclesSection },
];

const BaseSections = () => (
    <>
        {SECTIONS.map(({ id, Component }) => (
            <Component key={id} />
        ))}
    </>
);

export const baseGroup: ShowcaseGroup = {
    id: "base",
    title: "Base components",
    description:
        "The building blocks: buttons, button groups, badges, avatars, tags, tooltips, toggles, checkboxes, radio buttons, sliders and progress indicators.",
    entries: SECTIONS.map(({ id, title }) => ({ id, title })),
    Component: BaseSections,
};
