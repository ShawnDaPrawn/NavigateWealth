/**
 * Foundations & shared assets: the brand-neutral building blocks of the kit
 * (featured icons, logos, rating, brand icon sets), the shared illustrations and
 * patterns, the marketing header navigation, and browsers for both icon packages.
 */
import type { FC, ReactNode, SVGProps } from "react";
import { useMemo, useState } from "react";
import { FileIcon } from "@untitledui/file-icons";
import * as Icons from "@untitledui/icons";
import { BarChartSquare02, BookClosed, Briefcase01, Calculator, CheckCircle, FileShield02, PieChart03, ShieldTick, Stars02, Users01 } from "@untitledui/icons";
import type { Options as QRCodeStylingOptions } from "qr-code-styling";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Dot } from "@/components/foundations/dot-icon";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import * as IntegrationIcons from "@/components/foundations/integration-icons";
import { UntitledLogo } from "@/components/foundations/logo/untitledui-logo";
import { UntitledLogoMinimal } from "@/components/foundations/logo/untitledui-logo-minimal";
import * as PaymentIcons from "@/components/foundations/payment-icons";
import { PlayButtonIcon } from "@/components/foundations/play-button-icon";
import { RatingBadge, Wreath } from "@/components/foundations/rating-badge";
import { RatingStars, StarIcon } from "@/components/foundations/rating-stars";
import * as SocialIcons from "@/components/foundations/social-icons";
import { NavMenuItemLink } from "@/components/marketing/header-navigation/base-components/nav-menu-item";
import { DropdownMenuSimple } from "@/components/marketing/header-navigation/dropdown-header-navigation";
import { Header } from "@/components/marketing/header-navigation/header";
import { BackgroundPattern } from "@/components/shared-assets/background-patterns";
import { CreditCard } from "@/components/shared-assets/credit-card/credit-card";
import { MastercardIcon, MastercardIconWhite, PaypassIcon } from "@/components/shared-assets/credit-card/icons";
import { Illustration } from "@/components/shared-assets/illustrations";
import { IPhoneMockup } from "@/components/shared-assets/iphone-mockup";
import { QRCode } from "@/components/shared-assets/qr-code";
import { SectionDivider } from "@/components/shared-assets/section-divider";
import { cx } from "@/utils/cx";
import { Caption, Demo, Labelled, ShowcaseSection } from "../showcase-kit";
import type { ShowcaseGroup } from "../showcase-kit";

/* ------------------------------------------------------------------------------------------------
 * Shared data
 * --------------------------------------------------------------------------------------------- */

const SIZES = ["sm", "md", "lg", "xl"] as const;
const COLORS = ["brand", "gray", "success", "warning", "error"] as const;
const THEMES = ["light", "gradient", "dark", "modern", "modern-neue", "outline"] as const;

/** Splits "PascalCaseIcon" into a readable label. */
const humanise = (name: string) =>
    name
        .replace(/Icon$/, "")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");

type AnyIcon = FC<SVGProps<SVGSVGElement> & { grayscale?: boolean; size?: number }>;

const toEntries = (mod: Record<string, unknown>) =>
    Object.entries(mod)
        .filter(([, value]) => typeof value === "function")
        .map(([name, value]) => [name, value as AnyIcon] as const)
        .sort(([a], [b]) => a.localeCompare(b));

const integrationIcons = toEntries(IntegrationIcons);
const paymentIcons = toEntries(PaymentIcons);
const socialIcons = toEntries(SocialIcons);

/** Every exported component of @untitledui/icons (all are plain function components). */
const allIcons = Object.entries(Icons as Record<string, unknown>)
    .filter(([name, value]) => typeof value === "function" && /^[A-Z]/.test(name))
    .map(([name, value]) => [name, value as FC<{ className?: string }>] as const)
    .sort(([a], [b]) => a.localeCompare(b));

/** The file types FileIcon supports (mirrors SUPPORTED_FILE_TYPES in @untitledui/file-icons). */
const FILE_TYPES = [
    "audio",
    "code",
    "document",
    "empty",
    "folder",
    "image",
    "img",
    "spreadsheets",
    "video",
    "video-01",
    "video-02",
    "aep",
    "ai",
    "avi",
    "css",
    "csv",
    "dmg",
    "doc",
    "docx",
    "eps",
    "exe",
    "fig",
    "gif",
    "html",
    "indd",
    "java",
    "jpeg",
    "jpg",
    "js",
    "json",
    "mkv",
    "mp3",
    "mp4",
    "mpeg",
    "pdf",
    "pdf-simple",
    "png",
    "ppt",
    "pptx",
    "psd",
    "rar",
    "rss",
    "sql",
    "svg",
    "tiff",
    "txt",
    "wav",
    "webp",
    "xls",
    "xlsx",
    "xml",
    "zip",
] as const;

/** A named grid tile for icon sets. */
const IconTile = ({ name, children, className }: { name: string; children: ReactNode; className?: string }) => (
    <div className={cx("flex min-w-0 flex-col items-center gap-2 rounded-lg p-3 text-center ring-1 ring-secondary ring-inset", className)}>
        <div className="flex h-10 items-center justify-center">{children}</div>
        <span className="w-full truncate text-xs text-tertiary" title={name}>
            {name}
        </span>
    </div>
);

const iconGrid = "grid w-full grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3";

/* ------------------------------------------------------------------------------------------------
 * Foundations
 * --------------------------------------------------------------------------------------------- */

const FeaturedIconSection = () => (
    <ShowcaseSection
        id="fnd-featured-icon"
        title="Featured icon"
        description="Frames an icon to draw attention to a card, modal or empty state. Six themes, five colours and four sizes; every combination is shown below. The modern-neue theme only styles the gray colour."
        importPath="foundations/featured-icon/featured-icon"
        exports={["FeaturedIcon"]}
    >
        {THEMES.map((theme) => (
            <Demo key={theme} title={`theme="${theme}"`} className="flex-col items-stretch gap-5">
                {COLORS.map((color) => (
                    <div key={color} className="flex flex-wrap items-center gap-6">
                        <span className="w-16 text-xs font-medium text-quaternary">{color}</span>
                        {SIZES.map((size) => (
                            <div key={size} className="flex w-16 flex-col items-center gap-2">
                                <div className="flex size-14 items-center justify-center">
                                    <FeaturedIcon theme={theme} color={color} size={size} icon={PieChart03} />
                                </div>
                                <Caption>{size}</Caption>
                            </div>
                        ))}
                    </div>
                ))}
            </Demo>
        ))}
        <Demo title="Icon as a component or an element">
            <Labelled label="icon={ShieldTick}">
                <FeaturedIcon color="success" theme="light" size="lg" icon={ShieldTick} />
            </Labelled>
            <Labelled label="icon={<ShieldTick />}">
                <FeaturedIcon color="brand" theme="modern" size="lg" icon={<ShieldTick className="size-6" />} />
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

const DotIconSection = () => (
    <ShowcaseSection
        id="fnd-dot-icon"
        title="Dot icon"
        description="A small status dot that takes the current text colour. Used inside badges, tabs and status labels."
        importPath="foundations/dot-icon"
        exports={["Dot"]}
    >
        <Demo title="Sizes and colours">
            <Labelled label='size="sm"'>
                <Dot size="sm" className="text-fg-success-secondary" />
            </Labelled>
            <Labelled label='size="md"'>
                <Dot size="md" className="text-fg-success-secondary" />
            </Labelled>
            {[
                ["Active", "text-fg-success-secondary"],
                ["Pending review", "text-fg-warning-secondary"],
                ["Lapsed", "text-fg-error-secondary"],
                ["Draft", "text-fg-quaternary"],
                ["Brand", "text-fg-brand-secondary"],
            ].map(([label, colour]) => (
                <span key={label} className="flex items-center gap-1.5 text-sm font-medium text-secondary">
                    <Dot className={colour} /> {label}
                </span>
            ))}
        </Demo>
    </ShowcaseSection>
);

const LogoSection = () => (
    <ShowcaseSection
        id="fnd-logo"
        title="Logo"
        description="The kit's placeholder logos, full and minimal. Swap these for the Navigate Wealth marks in production."
        importPath="foundations/logo/untitledui-logo"
        exports={["UntitledLogo"]}
    >
        <Demo title="UntitledLogo">
            <Labelled label="h-8 (default)">
                <UntitledLogo />
            </Labelled>
            <Labelled label="h-10">
                <UntitledLogo className="h-10" />
            </Labelled>
            <Labelled label="h-6">
                <UntitledLogo className="h-6" />
            </Labelled>
        </Demo>
        <Demo title="UntitledLogoMinimal (from foundations/logo/untitledui-logo-minimal)">
            <Labelled label="size-8 (default)">
                <UntitledLogoMinimal />
            </Labelled>
            <Labelled label="size-12">
                <UntitledLogoMinimal className="size-12" />
            </Labelled>
            <Labelled label="size-6">
                <UntitledLogoMinimal className="size-6" />
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

const PlayButtonSection = () => (
    <ShowcaseSection
        id="fnd-play-button"
        title="Play button icon"
        description="A frosted play or pause control to lay over video thumbnails."
        importPath="foundations/play-button-icon"
        exports={["PlayButtonIcon"]}
    >
        <Demo title="States (over a video thumbnail)" className="gap-6">
            {[false, true].map((isPlaying) => (
                <Labelled key={String(isPlaying)} label={isPlaying ? "isPlaying" : "default"}>
                    <div className="group flex h-44 w-72 cursor-pointer items-center justify-center rounded-xl bg-linear-to-br from-brand-700 to-navy">
                        <PlayButtonIcon isPlaying={isPlaying} />
                    </div>
                </Labelled>
            ))}
            <Labelled label="className='size-14'">
                <div className="flex h-44 w-44 items-center justify-center rounded-xl bg-linear-to-br from-neutral-700 to-neutral-900">
                    <PlayButtonIcon className="size-14" />
                </div>
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

const RatingStarsSection = () => (
    <ShowcaseSection
        id="fnd-rating-stars"
        title="Rating stars"
        description="Star ratings with fractional fill, for adviser reviews and client feedback."
        importPath="foundations/rating-stars"
        exports={["RatingStars", "StarIcon", "getStarProgress"]}
    >
        <Demo title="RatingStars" className="flex-col items-start">
            {[5, 4.5, 3.7, 2, 0].map((rating) => (
                <div key={rating} className="flex items-center gap-3">
                    <RatingStars rating={rating} />
                    <span className="text-sm text-tertiary">rating={rating}</span>
                </div>
            ))}
            <div className="flex items-center gap-3">
                <RatingStars rating={8.5} stars={10} starClassName="size-4" className="gap-0.5" />
                <span className="text-sm text-tertiary">stars=10, rating=8.5, starClassName=&quot;size-4&quot;</span>
            </div>
        </Demo>
        <Demo title="StarIcon progress">
            {[100, 75, 50, 25, 0].map((progress) => (
                <Labelled key={progress} label={`progress=${progress}`}>
                    <StarIcon progress={progress} className="size-8" />
                </Labelled>
            ))}
        </Demo>
    </ShowcaseSection>
);

const RatingBadgeSection = () => (
    <ShowcaseSection
        id="fnd-rating-badge"
        title="Rating badge"
        description="A laurel-framed rating for social proof. The light theme is for dark surfaces."
        importPath="foundations/rating-badge"
        exports={["RatingBadge", "Wreath"]}
    >
        <Demo title='theme="dark" (default, for light surfaces)'>
            <RatingBadge title="Top-rated adviser" subtitle="480+ client reviews" rating={4.9} />
            <RatingBadge title="Retirement planning" subtitle="Rated 4.5 by clients" rating={4.5} />
        </Demo>
        <Demo title='theme="light" (for dark surfaces)' dark>
            <RatingBadge theme="light" title="Top-rated adviser" subtitle="480+ client reviews" rating={4.9} />
        </Demo>
        <Demo title="Wreath">
            <Wreath />
            <Wreath className="-scale-x-100 text-fg-brand-primary" />
        </Demo>
    </ShowcaseSection>
);

const IntegrationIconsSection = () => (
    <ShowcaseSection
        id="fnd-integration-icons"
        title="Integration icons"
        description={`All ${integrationIcons.length} integration icons, in colour and with the grayscale prop.`}
        importPath="foundations/integration-icons"
        exports={integrationIcons
            .slice(0, 3)
            .map(([name]) => name)
            .concat("…")}
    >
        <Demo title="Colour">
            <div className={iconGrid}>
                {integrationIcons.map(([name, Icon]) => (
                    <IconTile key={name} name={humanise(name)}>
                        <Icon className="size-8" />
                    </IconTile>
                ))}
            </div>
        </Demo>
        <Demo title="grayscale">
            <div className={iconGrid}>
                {integrationIcons.map(([name, Icon]) => (
                    <IconTile key={name} name={humanise(name)}>
                        <Icon grayscale className="size-8" />
                    </IconTile>
                ))}
            </div>
        </Demo>
    </ShowcaseSection>
);

const PaymentIconsSection = () => (
    <ShowcaseSection
        id="fnd-payment-icons"
        title="Payment icons"
        description={`All ${paymentIcons.length} payment method icons, for billing and fee collection screens.`}
        importPath="foundations/payment-icons"
        exports={paymentIcons
            .slice(0, 3)
            .map(([name]) => name)
            .concat("…")}
    >
        <Demo>
            <div className={iconGrid}>
                {paymentIcons.map(([name, Icon]) => (
                    <IconTile key={name} name={humanise(name)}>
                        <Icon className="h-8 w-auto" />
                    </IconTile>
                ))}
            </div>
        </Demo>
    </ShowcaseSection>
);

const SocialIconsSection = () => (
    <ShowcaseSection
        id="fnd-social-icons"
        title="Social icons"
        description={`All ${socialIcons.length} social icons. They take a numeric size prop.`}
        importPath="foundations/social-icons"
        exports={socialIcons
            .slice(0, 3)
            .map(([name]) => name)
            .concat("…")}
    >
        <Demo title="size={24}">
            <div className={iconGrid}>
                {socialIcons.map(([name, Icon]) => (
                    <IconTile key={name} name={humanise(name)}>
                        <Icon size={24} className="text-fg-secondary" />
                    </IconTile>
                ))}
            </div>
        </Demo>
        <Demo title="size={32}, on the navy surface" dark>
            {socialIcons.map(([name, Icon]) => (
                <Icon key={name} size={32} className="text-white" aria-label={name} />
            ))}
        </Demo>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------------------------------------
 * Shared assets
 * --------------------------------------------------------------------------------------------- */

const PATTERNS = [
    { pattern: "circle", sizes: ["sm", "md", "lg"] },
    { pattern: "square", sizes: ["sm", "md", "lg"] },
    { pattern: "grid", sizes: ["sm", "md", "lg"] },
    // grid-check only ships sm and md.
    { pattern: "grid-check", sizes: ["sm", "md"] },
] as const;

const BackgroundPatternsSection = () => (
    <ShowcaseSection
        id="fnd-background-patterns"
        title="Background patterns"
        description="Decorative patterns that sit behind featured icons and hero content. Each pattern is centred and cropped here; grid-check only comes in sm and md."
        importPath="shared-assets/background-patterns"
        exports={["BackgroundPattern"]}
    >
        {PATTERNS.map(({ pattern, sizes }) => (
            <Demo key={pattern} title={`pattern="${pattern}"`}>
                {sizes.map((size) => (
                    <Labelled key={size} label={`size="${size}"`}>
                        <div className="relative flex size-64 items-center justify-center overflow-hidden rounded-lg bg-primary ring-1 ring-secondary">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                <BackgroundPattern pattern={pattern} size={size} />
                            </div>
                            <FeaturedIcon theme="modern" color="gray" size="lg" icon={BarChartSquare02} />
                        </div>
                    </Labelled>
                ))}
            </Demo>
        ))}
    </ShowcaseSection>
);

const CARD_GROUPS = [
    { title: "Solid", types: ["brand-dark", "brand-light", "gray-dark", "gray-light"], backdrop: false },
    { title: "Transparent (for image or gradient backdrops)", types: ["transparent", "transparent-gradient"], backdrop: true },
    { title: "Horizontal strip", types: ["transparent-strip", "gray-strip", "gradient-strip", "salmon-strip"], backdrop: true },
    { title: "Vertical strip", types: ["gray-strip-vertical", "gradient-strip-vertical", "salmon-strip-vertical"], backdrop: true },
] as const;

const CreditCardSection = () => (
    <ShowcaseSection
        id="fnd-credit-card"
        title="Credit card"
        description="A scalable card visual for billing and fee payment screens, in 13 types. The width prop scales it proportionally."
        importPath="shared-assets/credit-card/credit-card"
        exports={["CreditCard"]}
    >
        {CARD_GROUPS.map(({ title, types, backdrop }) => (
            <Demo key={title} title={title} className={cx(backdrop && "bg-linear-to-br from-brand-600 via-navy to-neutral-900")}>
                {types.map((type) => (
                    <div key={type} className="flex flex-col gap-2">
                        <p className={cx("text-xs", backdrop ? "text-white/80" : "text-quaternary")}>type=&quot;{type}&quot;</p>
                        <CreditCard type={type} company="Navigate Wealth" cardHolder="T. MOKOENA" cardNumber="5412 7500 0000 4821" cardExpiration="09/29" />
                    </div>
                ))}
            </Demo>
        ))}
        <Demo title="width">
            {[200, 260, 360].map((width) => (
                <Labelled key={width} label={`width={${width}}`}>
                    <CreditCard
                        width={width}
                        type="brand-dark"
                        company="Navigate Wealth"
                        cardHolder="T. MOKOENA"
                        cardNumber="5412 7500 0000 4821"
                        cardExpiration="09/29"
                    />
                </Labelled>
            ))}
        </Demo>
        <Demo title="Card icons (from shared-assets/credit-card/icons)" className="bg-neutral-800">
            <Labelled label="MastercardIcon" className="text-white">
                <MastercardIcon />
            </Labelled>
            <Labelled label="MastercardIconWhite">
                <MastercardIconWhite />
            </Labelled>
            <Labelled label="PaypassIcon">
                <PaypassIcon className="text-white" />
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

const ILLUSTRATION_TYPES = ["box", "cloud", "documents", "credit-card"] as const;

const IllustrationsSection = () => (
    <ShowcaseSection
        id="fnd-illustrations"
        title="Illustrations"
        description="Empty-state illustrations in four types and three sizes. Children replace the default upload icon."
        importPath="shared-assets/illustrations"
        exports={["Illustration"]}
    >
        {ILLUSTRATION_TYPES.map((type) => (
            <Demo key={type} title={`type="${type}"`} className="items-end gap-8">
                {(["sm", "md", "lg"] as const).map((size) => (
                    <Labelled key={size} label={`size="${size}"`}>
                        <Illustration type={type} size={size} />
                    </Labelled>
                ))}
            </Demo>
        ))}
        <Demo title="Custom child icon">
            <Labelled label="type='documents' with <FileShield02 />">
                <Illustration type="documents" size="md">
                    <FileShield02 className="size-6" />
                </Illustration>
            </Labelled>
            <Labelled label="type='box' with <Briefcase01 />">
                <Illustration type="box" size="md">
                    <Briefcase01 className="size-6" />
                </Illustration>
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

/** A self-contained 750×1624 SVG app screen (no external images) for the phone mockup. */
const makeScreen = (dark: boolean) => {
    const bg = dark ? "#0C111D" : "#FFFFFF";
    const card = dark ? "#161B26" : "#F5F6F9";
    const text = dark ? "#F5F5F6" : "#181D27";
    const muted = dark ? "#94969C" : "#535862";
    const accent = "#6C5CE7";
    const rows = [
        ["Discretionary portfolio", "R 842 300", "+6.2%"],
        ["Retirement annuity", "R 318 950", "+4.8%"],
        ["Tax-free savings", "R 88 750", "+7.1%"],
    ]
        .map(
            ([name, value, change], i) =>
                `<rect x="48" y="${860 + i * 170}" width="654" height="140" rx="28" fill="${card}"/>` +
                `<text x="88" y="${920 + i * 170}" font-size="32" font-weight="600" fill="${text}">${name}</text>` +
                `<text x="88" y="${966 + i * 170}" font-size="28" fill="${muted}">${value}</text>` +
                `<text x="662" y="${944 + i * 170}" font-size="30" font-weight="600" fill="#17B26A" text-anchor="end">${change}</text>`,
        )
        .join("");
    const bars = [180, 240, 210, 300, 280, 360, 420]
        .map((h, i) => `<rect x="${96 + i * 84}" y="${740 - h}" width="48" height="${h}" rx="12" fill="${accent}" opacity="${0.4 + i * 0.08}"/>`)
        .join("");
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1624" viewBox="0 0 750 1624" font-family="Arial, Helvetica, sans-serif" text-rendering="geometricPrecision">` +
        `<rect width="750" height="1624" fill="${bg}"/>` +
        `<text x="48" y="150" font-size="34" fill="${muted}">Good morning, Thandi</text>` +
        `<text x="48" y="230" font-size="64" font-weight="700" fill="${text}">R 1 250 000</text>` +
        `<text x="48" y="285" font-size="30" fill="#17B26A">+R 64 200 this year</text>` +
        `<rect x="48" y="340" width="654" height="440" rx="32" fill="${card}"/>${bars}` +
        `<text x="48" y="830" font-size="36" font-weight="600" fill="${text}">Your investments</text>${rows}` +
        `<rect x="48" y="1400" width="654" height="112" rx="56" fill="${accent}"/>` +
        `<text x="375" y="1470" font-size="34" font-weight="600" fill="#FFFFFF" text-anchor="middle">Book a review with your adviser</text>` +
        `</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const IPhoneMockupSection = () => {
    const light = useMemo(() => makeScreen(false), []);
    const dark = useMemo(() => makeScreen(true), []);

    return (
        <ShowcaseSection
            id="fnd-iphone-mockup"
            title="iPhone mockup"
            description="A device frame for app screenshots. Pass image (and optionally imageDark); theme forces the frame colour, otherwise it follows the colour scheme."
            importPath="shared-assets/iphone-mockup"
            exports={["IPhoneMockup"]}
        >
            <Demo className="items-start gap-10">
                <Labelled label='theme="light"'>
                    <IPhoneMockup image={light} theme="light" className="w-56" />
                </Labelled>
                <Labelled label='theme="dark"'>
                    <IPhoneMockup image={dark} theme="dark" className="w-56" />
                </Labelled>
                <Labelled label="theme unset, image + imageDark">
                    <IPhoneMockup image={light} imageDark={dark} className="w-56" />
                </Labelled>
            </Demo>
        </ShowcaseSection>
    );
};

// Stable object: QRCode re-runs its effect whenever `options` changes identity.
const QR_BRAND_OPTIONS: QRCodeStylingOptions = {
    dotsOptions: { color: "#313653", type: "rounded" },
    cornersSquareOptions: { type: "extra-rounded" },
};

const QRCodeSection = () => (
    <ShowcaseSection
        id="fnd-qr-code"
        title="QR code"
        description="A framed QR code for app downloads, two-factor set-up and document links. Accepts qr-code-styling options."
        importPath="shared-assets/qr-code"
        exports={["QRCode", "GradientScan"]}
    >
        {/* React StrictMode mounts the effect twice in development; hide the duplicate canvas it appends. */}
        <Demo className="gap-10 [&_svg~svg]:hidden">
            <Labelled label='size="md"'>
                <QRCode value="https://www.navigatewealth.co.za/app" size="md" />
            </Labelled>
            <Labelled label='size="lg"'>
                <QRCode value="https://www.navigatewealth.co.za/app" size="lg" />
            </Labelled>
            <Labelled label="options (rounded, navy)">
                <QRCode value="https://www.navigatewealth.co.za/review" size="lg" options={QR_BRAND_OPTIONS} />
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

const SectionDividerSection = () => (
    <ShowcaseSection
        id="fnd-section-divider"
        title="Section divider"
        description="A contained horizontal rule that separates page sections at the container width."
        importPath="shared-assets/section-divider"
        exports={["SectionDivider"]}
    >
        <Demo className="flex-col items-stretch gap-6 px-0">
            <p className="px-4 text-md text-secondary md:px-8">Retirement planning</p>
            <SectionDivider className="w-full" />
            <p className="px-4 text-md text-secondary md:px-8">Estate planning</p>
        </Demo>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------------------------------------
 * Marketing: header navigation
 * --------------------------------------------------------------------------------------------- */

const PlanningMenu = () => (
    <div className="px-3 pb-2 md:max-w-84 md:p-0">
        <nav className="overflow-hidden rounded-2xl bg-primary py-2 shadow-xs ring-1 ring-secondary_alt md:p-2 md:shadow-lg">
            <ul className="flex flex-col gap-0.5">
                <li>
                    <NavMenuItemLink
                        href="#fnd-header-navigation"
                        icon={PieChart03}
                        title="Investment planning"
                        subtitle="Portfolios built around your goals and risk profile."
                    />
                </li>
                <li>
                    <NavMenuItemLink
                        href="#fnd-header-navigation"
                        icon={ShieldTick}
                        title="Risk cover"
                        subtitle="Life, disability and severe illness cover reviewed yearly."
                    />
                </li>
                <li>
                    <NavMenuItemLink
                        href="#fnd-header-navigation"
                        icon={Calculator}
                        title="Tax and estate"
                        subtitle="Wills, trusts and tax-efficient savings."
                    />
                </li>
            </ul>
        </nav>
    </div>
);

const NW_NAV_ITEMS = [
    { label: "Planning", href: "#fnd-header-navigation", menu: <PlanningMenu /> },
    { label: "Resources", href: "#fnd-header-navigation", menu: <DropdownMenuSimple /> },
    { label: "Fees", href: "#fnd-header-navigation" },
    { label: "About", href: "#fnd-header-navigation" },
];

/** Keeps anything fixed or sticky inside the demo box. */
const HeaderFrame = ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={cx("relative w-full [transform:translateZ(0)] overflow-hidden rounded-xl bg-secondary ring-1 ring-secondary", className)}>{children}</div>
);

const HeaderNavigationSection = () => (
    <ShowcaseSection
        id="fnd-header-navigation"
        title="Header navigation"
        description="The marketing site header with dropdown menus and a mobile menu (resize below md to see it). Dropdowns open in a popover; click Planning or Resources."
        importPath="marketing/header-navigation/header"
        exports={["Header"]}
    >
        <Demo title="Default (kit items)" className="p-0">
            <HeaderFrame className="rounded-none ring-0">
                <Header />
            </HeaderFrame>
        </Demo>
        <Demo title="Custom items" className="p-0">
            <HeaderFrame className="rounded-none bg-primary ring-0">
                <Header items={NW_NAV_ITEMS} />
            </HeaderFrame>
        </Demo>
        <Demo title="isFullWidth" className="p-0">
            <HeaderFrame className="rounded-none ring-0">
                <Header items={NW_NAV_ITEMS} isFullWidth />
            </HeaderFrame>
        </Demo>
        <Demo title="isFloating" className="p-0">
            <HeaderFrame className="rounded-none pb-3 ring-0">
                <Header items={NW_NAV_ITEMS} isFloating />
            </HeaderFrame>
        </Demo>
    </ShowcaseSection>
);

const DropdownNavigationSection = () => (
    <ShowcaseSection
        id="fnd-dropdown-header-navigation"
        title="Dropdown header navigation"
        description="The simple dropdown panel the header opens, rendered inline."
        importPath="marketing/header-navigation/dropdown-header-navigation"
        exports={["DropdownMenuSimple"]}
    >
        <Demo className="items-start bg-secondary">
            <DropdownMenuSimple />
            <PlanningMenu />
        </Demo>
    </ShowcaseSection>
);

const NavMenuItemSection = () => (
    <ShowcaseSection
        id="fnd-nav-menu-item"
        title="Nav menu item"
        description="One link in a dropdown menu: icon, title, optional subtitle, badge and actions."
        importPath="marketing/header-navigation/base-components/nav-menu-item"
        exports={["NavMenuItemLink"]}
    >
        <Demo className="items-start">
            <Labelled label="title only">
                <NavMenuItemLink href="#fnd-nav-menu-item" title="Client portal" />
            </Labelled>
            <Labelled label="icon + subtitle">
                <NavMenuItemLink
                    href="#fnd-nav-menu-item"
                    icon={Users01}
                    title="Meet our advisers"
                    subtitle="CFP® professionals in Johannesburg, Cape Town and Durban."
                />
            </Labelled>
            <Labelled label="badge">
                <NavMenuItemLink
                    href="#fnd-nav-menu-item"
                    icon={Stars02}
                    title="Market outlook"
                    subtitle="Our quarterly view on local and offshore markets."
                    badge={
                        <Badge size="sm" color="brand" type="pill-color">
                            New
                        </Badge>
                    }
                />
            </Labelled>
            <Labelled label="actionsContent + element icon">
                <NavMenuItemLink
                    href="#fnd-nav-menu-item"
                    icon={<FeaturedIcon icon={BookClosed} color="brand" theme="light" size="md" />}
                    title="Retirement guide"
                    subtitle="A plain-language guide to living annuities."
                    actionsContent={
                        <div className="flex gap-3">
                            <Button color="link-gray" size="sm">
                                Dismiss
                            </Button>
                            <Button color="link-color" size="sm" iconTrailing={CheckCircle}>
                                Read now
                            </Button>
                        </div>
                    }
                />
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

/* ------------------------------------------------------------------------------------------------
 * Icon packages
 * --------------------------------------------------------------------------------------------- */

/** Same layout as ShowcaseSection, but for components imported from an npm package rather than src/components. */
const PackageSection = ({
    id,
    title,
    description,
    importLine,
    children,
}: {
    id: string;
    title: string;
    description?: ReactNode;
    importLine: string;
    children: ReactNode;
}) => (
    <section id={id} data-showcase-section className="scroll-mt-6 border-t border-secondary pt-10 first:border-t-0 first:pt-0">
        <div className="flex flex-col gap-2">
            <h3 className="text-display-xs font-semibold text-primary">{title}</h3>
            {description && <p className="max-w-3xl text-md text-tertiary">{description}</p>}
            <code className="mt-1 block w-fit max-w-full overflow-x-auto rounded-lg bg-secondary px-3 py-2 font-mono text-xs text-secondary ring-1 ring-secondary ring-inset">
                {importLine}
            </code>
        </div>
        <div className="mt-6 flex flex-col gap-6">{children}</div>
    </section>
);

const INITIAL_ICON_LIMIT = 120;

const searchInputClass =
    "w-full max-w-sm rounded-lg bg-primary px-3.5 py-2.5 text-md text-primary shadow-xs ring-1 ring-primary outline-hidden ring-inset placeholder:text-placeholder focus:ring-2 focus:ring-brand";

const IconsSection = () => {
    const [query, setQuery] = useState("");
    const [showAll, setShowAll] = useState(false);

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? allIcons.filter(([name]) => name.toLowerCase().includes(q)) : allIcons;
    }, [query]);

    const visible = showAll ? matches : matches.slice(0, INITIAL_ICON_LIMIT);

    return (
        <PackageSection
            id="fnd-icons"
            title="Icons"
            description={`Every icon in @untitledui/icons (${allIcons.length} in total). Line icons that take the current colour; size them with size-* classes.`}
            importLine={'import { PieChart03, ShieldTick, … } from "@untitledui/icons";'}
        >
            <Demo className="flex-col items-stretch">
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setShowAll(false);
                        }}
                        placeholder="Search icons, e.g. chart, shield, user"
                        aria-label="Search icons"
                        className={searchInputClass}
                    />
                    <span className="text-sm text-tertiary">
                        {matches.length} match{matches.length === 1 ? "" : "es"}
                    </span>
                </div>
                <div className={iconGrid}>
                    {visible.map(([name, Icon]) => (
                        <IconTile key={name} name={name}>
                            <Icon className="size-6 text-fg-secondary" />
                        </IconTile>
                    ))}
                </div>
                {matches.length === 0 && <p className="text-sm text-tertiary">No icons match &ldquo;{query}&rdquo;.</p>}
                {!showAll && matches.length > INITIAL_ICON_LIMIT && (
                    <div>
                        <Button color="secondary" size="md" onClick={() => setShowAll(true)}>
                            Show all {matches.length}
                        </Button>
                    </div>
                )}
            </Demo>
        </PackageSection>
    );
};

const FileIconsSection = () => {
    const [query, setQuery] = useState("");
    const types = FILE_TYPES.filter((type) => type.includes(query.trim().toLowerCase()));

    return (
        <PackageSection
            id="fnd-file-icons"
            title="File icons"
            description="@untitledui/file-icons exports one FileIcon component. It takes a file extension or a MIME type, three variants, a light or dark theme and a pixel size."
            importLine={'import { FileIcon } from "@untitledui/file-icons";'}
        >
            <Demo title="Every type × variant" className="flex-col items-stretch">
                <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Filter file types, e.g. pdf, xls"
                    aria-label="Filter file types"
                    className={searchInputClass}
                />
                <div className={iconGrid}>
                    {types.map((type) => (
                        <IconTile key={type} name={type}>
                            <div className="flex gap-1.5">
                                <FileIcon type={type} variant="default" size={32} />
                                <FileIcon type={type} variant="gray" size={32} />
                                <FileIcon type={type} variant="solid" size={32} />
                            </div>
                        </IconTile>
                    ))}
                </div>
                <Caption>Each tile: variant=&quot;default&quot;, &quot;gray&quot;, &quot;solid&quot;.</Caption>
            </Demo>
            <Demo title='theme="dark"' dark>
                {(["pdf", "xlsx", "docx", "csv", "folder"] as const).map((type) => (
                    <div key={type} className="flex gap-1.5">
                        <FileIcon type={type} theme="dark" size={40} />
                        <FileIcon type={type} theme="dark" variant="gray" size={40} />
                        <FileIcon type={type} theme="dark" variant="solid" size={40} />
                    </div>
                ))}
            </Demo>
            <Demo title="MIME types and sizes">
                {["application/pdf", "image/png", "video/mp4", "audio/mpeg", "text/html", "unknown/type"].map((mime) => (
                    <Labelled key={mime} label={mime}>
                        <FileIcon type={mime} size={40} />
                    </Labelled>
                ))}
                {[24, 32, 48, 64].map((size) => (
                    <Labelled key={size} label={`size={${size}}`}>
                        <FileIcon type="pdf" size={size} />
                    </Labelled>
                ))}
            </Demo>
        </PackageSection>
    );
};

/* ------------------------------------------------------------------------------------------------
 * Group
 * --------------------------------------------------------------------------------------------- */

const SECTIONS: { id: string; title: string; Component: FC }[] = [
    { id: "fnd-featured-icon", title: "Featured icon", Component: FeaturedIconSection },
    { id: "fnd-dot-icon", title: "Dot icon", Component: DotIconSection },
    { id: "fnd-logo", title: "Logo", Component: LogoSection },
    { id: "fnd-play-button", title: "Play button icon", Component: PlayButtonSection },
    { id: "fnd-rating-stars", title: "Rating stars", Component: RatingStarsSection },
    { id: "fnd-rating-badge", title: "Rating badge", Component: RatingBadgeSection },
    { id: "fnd-integration-icons", title: "Integration icons", Component: IntegrationIconsSection },
    { id: "fnd-payment-icons", title: "Payment icons", Component: PaymentIconsSection },
    { id: "fnd-social-icons", title: "Social icons", Component: SocialIconsSection },
    { id: "fnd-background-patterns", title: "Background patterns", Component: BackgroundPatternsSection },
    { id: "fnd-credit-card", title: "Credit card", Component: CreditCardSection },
    { id: "fnd-illustrations", title: "Illustrations", Component: IllustrationsSection },
    { id: "fnd-iphone-mockup", title: "iPhone mockup", Component: IPhoneMockupSection },
    { id: "fnd-qr-code", title: "QR code", Component: QRCodeSection },
    { id: "fnd-section-divider", title: "Section divider", Component: SectionDividerSection },
    { id: "fnd-header-navigation", title: "Header navigation", Component: HeaderNavigationSection },
    { id: "fnd-dropdown-header-navigation", title: "Dropdown header navigation", Component: DropdownNavigationSection },
    { id: "fnd-nav-menu-item", title: "Nav menu item", Component: NavMenuItemSection },
    { id: "fnd-icons", title: "Icons", Component: IconsSection },
    { id: "fnd-file-icons", title: "File icons", Component: FileIconsSection },
];

const FoundationsSections = () => (
    <>
        {SECTIONS.map(({ id, Component }) => (
            <Component key={id} />
        ))}
    </>
);

export const foundationsGroup: ShowcaseGroup = {
    id: "foundations",
    title: "Foundations & shared assets",
    description:
        "The building blocks beneath every screen: featured icons, logos, ratings and brand icon sets; shared illustrations, patterns and device mockups; the marketing header; and browsers for the full icon and file-icon packages.",
    entries: SECTIONS.map(({ id, title }) => ({ id, title })),
    Component: FoundationsSections,
};
