/**
 * Forms, inputs & menus: every text input, select, form helper and dropdown in
 * the Untitled UI React kit, shown with Navigate Wealth sample content.
 */
import { type FormEvent, type ReactNode, useState } from "react";
import {
    Archive,
    BarChart01,
    Briefcase01,
    Building07,
    Calendar,
    Copy01,
    CurrencyDollarCircle,
    Edit04,
    File06,
    Mail01,
    MarkerPin01,
    Phone,
    PieChart01,
    Plus,
    SearchLg,
    Share07,
    ShieldTick,
    Trash01,
    UploadCloud02,
    User01,
    Users01,
} from "@untitledui/icons";
import type { Key, Selection } from "react-aria-components";
import { Dialog as AriaDialog, DialogTrigger as AriaDialogTrigger, ListBox as AriaListBox, SubmenuTrigger } from "react-aria-components";
import { useListData } from "react-stately";
import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { DropdownAccountBreadcrumb } from "@/components/base/dropdown/dropdown-account-breadcrumb";
import { DropdownAccountButton } from "@/components/base/dropdown/dropdown-account-button";
import { DropdownAccountCardMD } from "@/components/base/dropdown/dropdown-account-card-md";
import { DropdownAccountCardSM } from "@/components/base/dropdown/dropdown-account-card-sm";
import { DropdownAccountCardXS } from "@/components/base/dropdown/dropdown-account-card-xs";
import { DropdownAvatar } from "@/components/base/dropdown/dropdown-avatar";
import { DropdownButtonAdvanced } from "@/components/base/dropdown/dropdown-button-advanced";
import { DropdownButtonLink } from "@/components/base/dropdown/dropdown-button-link";
import { DropdownButtonSimple } from "@/components/base/dropdown/dropdown-button-simple";
import { DropdownContextMenuAdvanced } from "@/components/base/dropdown/dropdown-context-menu-advanced";
import { DropdownContextMenuSimple } from "@/components/base/dropdown/dropdown-context-menu-simple";
import { DropdownIconAdvanced } from "@/components/base/dropdown/dropdown-icon-advanced";
import { DropdownIconSimple } from "@/components/base/dropdown/dropdown-icon-simple";
import { DropdownIntegration } from "@/components/base/dropdown/dropdown-integration";
import { DropdownSearchAdvanced } from "@/components/base/dropdown/dropdown-search-advanced";
import { DropdownSearchSimple } from "@/components/base/dropdown/dropdown-search-simple";
import { FileTrigger } from "@/components/base/file-upload-trigger/file-upload-trigger";
import { Form } from "@/components/base/form/form";
import { HintText } from "@/components/base/input/hint-text";
import { Input, InputBase, TextField } from "@/components/base/input/input";
import { InputDate } from "@/components/base/input/input-date";
import { InputFile } from "@/components/base/input/input-file";
import { InputGroup, InputPrefix } from "@/components/base/input/input-group";
import { InputNumber } from "@/components/base/input/input-number";
import { PaymentInput } from "@/components/base/input/input-payment";
import { InputTags } from "@/components/base/input/input-tags";
import { InputTagsOuter } from "@/components/base/input/input-tags-outer";
import { Label } from "@/components/base/input/label";
import { PinInput } from "@/components/base/input/pin-input";
import { ComboBox } from "@/components/base/select/combobox";
import { MultiSelect } from "@/components/base/select/multi-select";
import { Popover } from "@/components/base/select/popover";
import { Select, type SelectItemType } from "@/components/base/select/select";
import { SelectItem } from "@/components/base/select/select-item";
import { NativeSelect } from "@/components/base/select/select-native";
import { TagSelect } from "@/components/base/select/tag-select";
import { TextArea } from "@/components/base/textarea/textarea";
import { Caption, Demo, Labelled, type ShowcaseGroup, ShowcaseSection } from "../showcase-kit";

/* -------------------------------------------------------------------------- */
/*                                Sample content                              */
/* -------------------------------------------------------------------------- */

/** An initials avatar as an inline SVG data URI, so nothing loads from the network. */
const initialsAvatar = (initials: string, bg: string) =>
    `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="${bg}"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="600" fill="#ffffff">${initials}</text></svg>`,
    )}`;

const advisers: SelectItemType[] = [
    { id: "thandi", label: "Thandi Mokoena", supportingText: "Johannesburg", avatarUrl: initialsAvatar("TM", "#1B2A4A") },
    { id: "pieter", label: "Pieter van der Merwe", supportingText: "Stellenbosch", avatarUrl: initialsAvatar("PV", "#2E6F6A") },
    { id: "aisha", label: "Aisha Patel", supportingText: "Durban", avatarUrl: initialsAvatar("AP", "#8A5A2B") },
    { id: "sipho", label: "Sipho Ndlovu", supportingText: "Pretoria", avatarUrl: initialsAvatar("SN", "#4B3F72") },
    { id: "lerato", label: "Lerato Khumalo", supportingText: "On leave", avatarUrl: initialsAvatar("LK", "#6B7280"), isDisabled: true },
];

const provinces: SelectItemType[] = [
    { id: "gp", label: "Gauteng", supportingText: "GP" },
    { id: "wc", label: "Western Cape", supportingText: "WC" },
    { id: "kzn", label: "KwaZulu-Natal", supportingText: "KZN" },
    { id: "ec", label: "Eastern Cape", supportingText: "EC" },
    { id: "fs", label: "Free State", supportingText: "FS" },
    { id: "lp", label: "Limpopo", supportingText: "LP" },
    { id: "mp", label: "Mpumalanga", supportingText: "MP" },
    { id: "nw", label: "North West", supportingText: "NW" },
    { id: "nc", label: "Northern Cape", supportingText: "NC" },
];

const products: SelectItemType[] = [
    { id: "ra", label: "Retirement annuity", supportingText: "Section 10C", icon: ShieldTick },
    { id: "tfsa", label: "Tax-free savings account", supportingText: "R 36 000 p.a.", icon: PieChart01 },
    { id: "la", label: "Living annuity", supportingText: "2.5% - 17.5%", icon: BarChart01 },
    { id: "endow", label: "Endowment", supportingText: "5-year term", icon: Briefcase01 },
    { id: "unit", label: "Unit trust portfolio", supportingText: "Discretionary", icon: CurrencyDollarCircle },
    { id: "offshore", label: "Offshore feeder fund", supportingText: "Not available", icon: Building07, isDisabled: true },
];

const W = "w-full sm:w-80";

/* -------------------------------------------------------------------------- */
/*                                   Inputs                                   */
/* -------------------------------------------------------------------------- */

const InputSection = () => {
    const [name, setName] = useState("Nomvula Dlamini");

    return (
        <ShowcaseSection
            id="form-input"
            title="Input & TextField"
            description="Single-line text input with label, hint, required marker, help tooltip, leading icon, keyboard shortcut, invalid, disabled and password states. TextField + InputBase are the lower-level parts Input is built from."
            importPath="base/input/input"
            exports={["Input", "InputBase", "TextField"]}
        >
            <Demo title="Sizes" className="items-start">
                <Labelled label='size="sm"' className={W}>
                    <Input size="sm" label="Client name" placeholder="e.g. Nomvula Dlamini" />
                </Labelled>
                <Labelled label='size="md" (default)' className={W}>
                    <Input size="md" label="Client name" placeholder="e.g. Nomvula Dlamini" />
                </Labelled>
                <Labelled label='size="lg"' className={W}>
                    <Input size="lg" label="Client name" placeholder="e.g. Nomvula Dlamini" />
                </Labelled>
            </Demo>

            <Demo title="Label, hint, required, tooltip, icon & shortcut" className="items-start">
                <Labelled label="Controlled, with hint" className={W}>
                    <Input label="Full name" value={name} onChange={setName} hint={`Stored as: "${name}"`} />
                </Labelled>
                <Labelled label="isRequired" className={W}>
                    <Input isRequired label="Email address" type="email" placeholder="client@example.co.za" icon={Mail01} />
                </Labelled>
                <Labelled label="tooltip (help icon)" className={W}>
                    <Input label="ID number" placeholder="000000 0000 00 0" tooltip="13-digit South African ID number. Sample only." />
                </Labelled>
                <Labelled label="Leading icon" className={W}>
                    <Input label="Mobile" placeholder="+27 00 000 0000" icon={Phone} />
                </Labelled>
                <Labelled label="shortcut" className={W}>
                    <Input aria-label="Search clients" placeholder="Search clients" icon={SearchLg} shortcut="⌘K" />
                </Labelled>
                <Labelled label='type="password"' className={W}>
                    <Input label="Password" type="password" defaultValue="navigate-wealth" />
                </Labelled>
            </Demo>

            <Demo title="States" className="items-start">
                <Labelled label="isInvalid" className={W}>
                    <Input isInvalid label="Tax number" defaultValue="12345" hint="Tax reference numbers are 10 digits." />
                </Labelled>
                <Labelled label="isDisabled" className={W}>
                    <Input isDisabled label="Adviser code" defaultValue="NW-0042" hint="Assigned by compliance." />
                </Labelled>
                <Labelled label="hideRequiredIndicator" className={W}>
                    <Input isRequired hideRequiredIndicator label="Surname" placeholder="Dlamini" />
                </Labelled>
            </Demo>

            <Demo title="Composition: TextField + Label + InputBase + HintText" className="items-start">
                <TextField className={W} size="md" isRequired>
                    <Label>Residential suburb</Label>
                    <InputBase icon={MarkerPin01} placeholder="e.g. Rosebank" />
                    <HintText>Built from the primitives directly.</HintText>
                </TextField>
            </Demo>
        </ShowcaseSection>
    );
};

const InputGroupSection = () => (
    <ShowcaseSection
        id="form-input-group"
        title="InputGroup & InputPrefix"
        description="Wraps an InputBase with leading/trailing text addons, inline prefix text, or a NativeSelect dropdown on either side."
        importPath="base/input/input-group"
        exports={["InputGroup", "InputPrefix"]}
    >
        <Demo title="Text addons" className="items-start">
            <Labelled label="Leading text (InputPrefix)" className={W}>
                <InputGroup label="Client portal link" hint="Shared with the client by email." leadingAddon={<InputPrefix>navigatewealth.co.za/</InputPrefix>}>
                    <InputBase placeholder="nomvula-dlamini" />
                </InputGroup>
            </Labelled>
            <Labelled label="Trailing text" className={W}>
                <InputGroup label="Annual contribution" trailingAddon={<InputPrefix>ZAR</InputPrefix>}>
                    <InputBase placeholder="36 000" />
                </InputGroup>
            </Labelled>
            <Labelled label="Both, size sm" className={W}>
                <InputGroup
                    size="sm"
                    label="Fee"
                    leadingAddon={<InputGroup.Prefix>R</InputGroup.Prefix>}
                    trailingAddon={<InputGroup.Prefix>p.m.</InputGroup.Prefix>}
                >
                    <InputBase placeholder="850" />
                </InputGroup>
            </Labelled>
        </Demo>

        <Demo title="Dropdown addons" className="items-start">
            <Labelled label="Leading dropdown" className={W}>
                <InputGroup
                    label="Phone number"
                    leadingAddon={
                        <NativeSelect
                            aria-label="Country code"
                            options={[
                                { label: "ZA", value: "za" },
                                { label: "BW", value: "bw" },
                                { label: "NA", value: "na" },
                            ]}
                        />
                    }
                >
                    <InputBase placeholder="+27 00 000 0000" />
                </InputGroup>
            </Labelled>
            <Labelled label="prefix + trailing dropdown" className={W}>
                <InputGroup
                    label="Lump-sum investment"
                    prefix="R"
                    trailingAddon={
                        <NativeSelect
                            aria-label="Currency"
                            options={[
                                { label: "ZAR", value: "zar" },
                                { label: "USD", value: "usd" },
                                { label: "GBP", value: "gbp" },
                            ]}
                        />
                    }
                >
                    <InputBase placeholder="1 250 000" />
                </InputGroup>
            </Labelled>
            <Labelled label="isDisabled" className={W}>
                <InputGroup isDisabled label="Client portal link" leadingAddon={<InputPrefix>navigatewealth.co.za/</InputPrefix>}>
                    <InputBase placeholder="locked" />
                </InputGroup>
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

const InputDateSection = () => (
    <ShowcaseSection
        id="form-input-date"
        title="InputDate"
        description="Segmented date field (React Aria DateField). Type or use the arrow keys on each segment."
        importPath="base/input/input-date"
        exports={["InputDate", "InputDateBase"]}
    >
        <Demo className="items-start">
            <Labelled label='size="sm"' className={W}>
                <InputDate size="sm" label="Date of birth" hint="Used to calculate retirement age." />
            </Labelled>
            <Labelled label="Icon + tooltip, md" className={W}>
                <InputDate label="Next review date" icon={Calendar} tooltip="Annual review with your adviser." />
            </Labelled>
            <Labelled label='lg, granularity="minute"' className={W}>
                <InputDate size="lg" label="Meeting" granularity="minute" />
            </Labelled>
            <Labelled label="isRequired + isInvalid" className={W}>
                <InputDate isRequired isInvalid label="Policy start" hint="A start date is required." />
            </Labelled>
            <Labelled label="isDisabled" className={W}>
                <InputDate isDisabled label="Inception date" />
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

const InputFileSection = () => {
    const [files, setFiles] = useState<string>("");

    return (
        <ShowcaseSection
            id="form-input-file"
            title="InputFile"
            description="A read-only input with an upload button that opens the file picker and shows the chosen file names."
            importPath="base/input/input-file"
            exports={["InputFile"]}
        >
            <Demo className="items-start">
                <Labelled label='size="sm" (default), onChange' className={W}>
                    <InputFile
                        label="Proof of address"
                        hint={files ? `Selected: ${files}` : "PDF or image, not older than 3 months."}
                        acceptedFileTypes={["application/pdf", "image/*"]}
                        onChange={(list) => setFiles(list ? Array.from(list, (f) => f.name).join(", ") : "")}
                    />
                </Labelled>
                <Labelled label='size="md", allowsMultiple, required' className={W}>
                    <InputFile size="md" isRequired allowsMultiple label="Bank statements" placeholder="Choose files" buttonText="Browse" />
                </Labelled>
                <Labelled label='size="lg", isLoading' className={W}>
                    <InputFile size="lg" isLoading label="Tax certificate (IT3b)" />
                </Labelled>
                <Labelled label="isInvalid" className={W}>
                    <InputFile isInvalid label="Certified ID copy" hint="The file could not be read." />
                </Labelled>
                <Labelled label="isDisabled" className={W}>
                    <InputFile isDisabled label="Signed mandate" />
                </Labelled>
            </Demo>
        </ShowcaseSection>
    );
};

const InputNumberSection = () => {
    const [amount, setAmount] = useState(1250000);

    return (
        <ShowcaseSection
            id="form-input-number"
            title="InputNumber"
            description="Numeric field with stepper buttons, locale formatting and min/max limits (React Aria NumberField)."
            importPath="base/input/input-number"
            exports={["InputNumber", "InputNumberBase"]}
        >
            <Demo className="items-start">
                <Labelled label='Vertical steppers, currency "ZAR"' className={W}>
                    <InputNumber
                        label="Investment amount"
                        value={amount}
                        onChange={setAmount}
                        step={10000}
                        minValue={0}
                        formatOptions={{ style: "currency", currency: "ZAR", maximumFractionDigits: 0 }}
                        hint={`Value: ${amount}`}
                    />
                </Labelled>
                <Labelled label='orientation="horizontal", size sm' className={W}>
                    <InputNumber size="sm" orientation="horizontal" label="Dependants" defaultValue={2} minValue={0} maxValue={10} />
                </Labelled>
                <Labelled label="Percent, lg" className={W}>
                    <InputNumber
                        size="lg"
                        label="Drawdown rate"
                        defaultValue={0.05}
                        step={0.005}
                        minValue={0.025}
                        maxValue={0.175}
                        formatOptions={{ style: "percent", maximumFractionDigits: 1 }}
                    />
                </Labelled>
                <Labelled label="isInvalid" className={W}>
                    <InputNumber isInvalid label="Retirement age" defaultValue={42} hint="Must be 55 or older." />
                </Labelled>
                <Labelled label="isDisabled" className={W}>
                    <InputNumber isDisabled label="Units held" defaultValue={1520} />
                </Labelled>
            </Demo>
        </ShowcaseSection>
    );
};

const PaymentInputSection = () => {
    const [card, setCard] = useState("");

    return (
        <ShowcaseSection
            id="form-payment-input"
            title="PaymentInput"
            description="Card number input that groups digits in fours and swaps the card-brand icon as you type (4 = Visa, 51-55 = Mastercard, 34/37 = Amex)."
            importPath="base/input/input-payment"
            exports={["PaymentInput"]}
        >
            <Demo className="items-start">
                <Labelled label="Controlled (raw digits shown below)" className={W}>
                    <PaymentInput label="Card number" placeholder="1234 1234 1234 1234" value={card} onChange={setCard} hint={`Digits: ${card || "none"}`} />
                </Labelled>
                <Labelled label='size="sm", Mastercard test number' className={W}>
                    <PaymentInput size="sm" label="Debit card" defaultValue="5100000000000000" />
                </Labelled>
                <Labelled label='size="lg", Visa test number' className={W}>
                    <PaymentInput size="lg" label="Credit card" defaultValue="4000000000000000" />
                </Labelled>
                <Labelled label="isInvalid" className={W}>
                    <PaymentInput isInvalid label="Card number" defaultValue="3700" hint="Card number is incomplete." />
                </Labelled>
                <Labelled label="isDisabled" className={W}>
                    <PaymentInput isDisabled label="Card on file" defaultValue="4000000000000000" />
                </Labelled>
            </Demo>
        </ShowcaseSection>
    );
};

const InputTagsSection = () => {
    const [goals, setGoals] = useState<string[]>(["Retirement", "Education"]);

    return (
        <ShowcaseSection
            id="form-input-tags"
            title="InputTags"
            description="Type and press Enter to add a tag inside the field; Backspace or the × removes one. Supports max tags, duplicates and validation."
            importPath="base/input/input-tags"
            exports={["InputTags"]}
        >
            <Demo className="items-start">
                <Labelled label="Controlled" className={W}>
                    <InputTags label="Financial goals" placeholder="Add a goal" value={goals} onChange={setGoals} hint={`${goals.length} goal(s)`} />
                </Labelled>
                <Labelled label='size="sm", maxTags=3, tooltip' className={W}>
                    <InputTags
                        size="sm"
                        label="Risk flags"
                        tooltip="Up to three flags."
                        maxTags={3}
                        defaultValue={["PEP", "Offshore"]}
                        placeholder="Add a flag"
                    />
                </Labelled>
                <Labelled label='size="lg", validate (emails only)' className={W}>
                    <InputTags
                        size="lg"
                        isRequired
                        label="CC on statements"
                        placeholder="name@example.co.za"
                        validate={(v) => /.+@.+\..+/.test(v)}
                        hint="Only valid email addresses are accepted."
                    />
                </Labelled>
                <Labelled label="isInvalid" className={W}>
                    <InputTags isInvalid label="Beneficiaries" placeholder="Add a beneficiary" hint="Add at least one beneficiary." />
                </Labelled>
                <Labelled label="isDisabled" className={W}>
                    <InputTags isDisabled label="Tags" defaultValue={["Locked"]} />
                </Labelled>
            </Demo>
        </ShowcaseSection>
    );
};

const InputTagsOuterSection = () => (
    <ShowcaseSection
        id="form-input-tags-outer"
        title="InputTagsOuter"
        description="Same behaviour as InputTags, but the tags are listed underneath the input instead of inside it."
        importPath="base/input/input-tags-outer"
        exports={["InputTagsOuter"]}
    >
        <Demo className="items-start">
            <Labelled label='size="sm"' className={W}>
                <InputTagsOuter size="sm" label="Asset classes" placeholder="Add and press Enter" defaultValue={["Equities", "Bonds"]} />
            </Labelled>
            <Labelled label='size="md", hint while empty, tooltip' className={W}>
                <InputTagsOuter label="Interests" tooltip="Used to tailor newsletters." placeholder="e.g. Offshore" hint="Press Enter to add." />
            </Labelled>
            <Labelled label='size="lg", maxTags=4' className={W}>
                <InputTagsOuter size="lg" label="Share codes" maxTags={4} defaultValue={["NPN", "SBK", "FSR"]} placeholder="JSE code" />
            </Labelled>
            <Labelled label="isInvalid" className={W}>
                <InputTagsOuter isInvalid label="Dependants" placeholder="Add a name" hint="At least one is required." />
            </Labelled>
            <Labelled label="isDisabled" className={W}>
                <InputTagsOuter isDisabled label="Read-only tags" defaultValue={["Archived"]} />
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

const LabelHintSection = () => (
    <ShowcaseSection
        id="form-label-hint"
        title="Label & HintText"
        description="The field label (with required asterisk and optional help tooltip) and the helper / error text used by every input."
        importPath="base/input/label"
        exports={["Label"]}
    >
        <Demo title="Label" className="items-start">
            <Labelled label="Plain">
                <Label>Marital status</Label>
            </Labelled>
            <Labelled label="isRequired">
                <Label isRequired>Marital status</Label>
            </Labelled>
            <Labelled label="isRequired + isInvalid">
                <Label isRequired isInvalid>
                    Marital status
                </Label>
            </Labelled>
            <Labelled label="tooltip + tooltipDescription">
                <Label tooltip="Why we ask" tooltipDescription="Community of property affects estate planning.">
                    Marital status
                </Label>
            </Labelled>
        </Demo>
        <Demo title="HintText (import from base/input/hint-text)" className="items-start">
            <Labelled label='size="md"'>
                <HintText>We will never share your details.</HintText>
            </Labelled>
            <Labelled label='size="sm"'>
                <HintText size="sm">We will never share your details.</HintText>
            </Labelled>
            <Labelled label="isInvalid">
                <HintText isInvalid>Please enter a valid ID number.</HintText>
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

const PinInputSection = () => {
    const [otp, setOtp] = useState("");
    // input-otp forwards defaultValue alongside value, so the prefilled example is controlled.
    const [expired, setExpired] = useState("1234");
    const sizes = ["xxxs", "xxs", "xs", "sm", "md", "lg"] as const;

    return (
        <ShowcaseSection
            id="form-pin-input"
            title="PinInput"
            description="One-time PIN / verification code input built on input-otp, in six sizes, with optional separator, label, description, invalid and disabled states."
            importPath="base/input/pin-input"
            exports={["PinInput"]}
        >
            <Demo title="Sizes (4 digits)" className="flex-col items-start">
                {sizes.map((size) => (
                    <Labelled key={size} label={`size="${size}"`}>
                        <PinInput size={size}>
                            <PinInput.Group maxLength={4}>
                                {[0, 1, 2, 3].map((i) => (
                                    <PinInput.Slot key={i} index={i} />
                                ))}
                            </PinInput.Group>
                        </PinInput>
                    </Labelled>
                ))}
            </Demo>

            <Demo title="6 digits with separator, label & description" className="items-start">
                <Labelled label="Controlled">
                    <PinInput size="xs">
                        <PinInput.Label>Verification code</PinInput.Label>
                        <PinInput.Group maxLength={6} value={otp} onChange={setOtp}>
                            <PinInput.Slot index={0} />
                            <PinInput.Slot index={1} />
                            <PinInput.Slot index={2} />
                            <PinInput.Separator />
                            <PinInput.Slot index={3} />
                            <PinInput.Slot index={4} />
                            <PinInput.Slot index={5} />
                        </PinInput.Group>
                        <PinInput.Description>{otp.length === 6 ? "Code complete." : "We sent a code to +27 •• ••• 0000."}</PinInput.Description>
                    </PinInput>
                </Labelled>
                <Labelled label="invalid">
                    <PinInput size="xs" invalid>
                        <PinInput.Label>Verification code</PinInput.Label>
                        <PinInput.Group maxLength={4} value={expired} onChange={setExpired}>
                            {[0, 1, 2, 3].map((i) => (
                                <PinInput.Slot key={i} index={i} />
                            ))}
                        </PinInput.Group>
                        <PinInput.Description>That code has expired.</PinInput.Description>
                    </PinInput>
                </Labelled>
                <Labelled label="disabled">
                    <PinInput size="xs" disabled>
                        <PinInput.Label>Verification code</PinInput.Label>
                        <PinInput.Group maxLength={4}>
                            {[0, 1, 2, 3].map((i) => (
                                <PinInput.Slot key={i} index={i} />
                            ))}
                        </PinInput.Group>
                    </PinInput>
                </Labelled>
            </Demo>
        </ShowcaseSection>
    );
};

const TextAreaSection = () => {
    const [notes, setNotes] = useState("");

    return (
        <ShowcaseSection
            id="form-textarea"
            title="TextArea"
            description="Multi-line text field with a resize handle, in two sizes."
            importPath="base/textarea/textarea"
            exports={["TextArea", "TextAreaBase"]}
        >
            <Demo className="items-start">
                <Labelled label='size="md", controlled, tooltip, required' className={W}>
                    <TextArea
                        isRequired
                        label="Meeting notes"
                        tooltip="Visible to the compliance team."
                        placeholder="Discussed rebalancing the living annuity…"
                        rows={4}
                        value={notes}
                        onChange={setNotes}
                        hint={`${notes.length}/500 characters`}
                        maxLength={500}
                    />
                </Labelled>
                <Labelled label='size="sm"' className={W}>
                    <TextArea size="sm" label="Special instructions" placeholder="Optional" rows={4} />
                </Labelled>
                <Labelled label="isInvalid" className={W}>
                    <TextArea isInvalid label="Reason for switch" defaultValue="n/a" hint="Please give a full reason (FAIS record of advice)." rows={4} />
                </Labelled>
                <Labelled label="isDisabled" className={W}>
                    <TextArea isDisabled label="Adviser summary" defaultValue="Signed off on 01/01/2026." rows={4} />
                </Labelled>
            </Demo>
        </ShowcaseSection>
    );
};

/* -------------------------------------------------------------------------- */
/*                                   Selects                                  */
/* -------------------------------------------------------------------------- */

const SelectSection = () => {
    const [adviser, setAdviser] = useState<Key | null>("thandi");

    return (
        <ShowcaseSection
            id="form-select"
            title="Select"
            description="Single-choice dropdown (React Aria Select). Items can carry an icon, avatar, supporting text or be disabled. Select.Item and Select.ComboBox are attached as statics."
            importPath="base/select/select"
            exports={["Select"]}
        >
            <Demo title="Sizes & placeholder" className="items-start">
                {(["sm", "md", "lg"] as const).map((size) => (
                    <Labelled key={size} label={`size="${size}"`} className={W}>
                        <Select size={size} label="Province" placeholder="Select a province" items={provinces}>
                            {(item) => (
                                <Select.Item id={item.id} supportingText={item.supportingText}>
                                    {item.label}
                                </Select.Item>
                            )}
                        </Select>
                    </Labelled>
                ))}
            </Demo>

            <Demo title="Icons, avatars, supporting text & disabled items" className="items-start">
                <Labelled label="Avatar items, controlled" className={W}>
                    <Select
                        label="Assigned adviser"
                        items={advisers}
                        selectedKey={adviser}
                        onSelectionChange={setAdviser}
                        hint={`Selected key: ${String(adviser)}`}
                    >
                        {(item) => (
                            <Select.Item id={item.id} avatarUrl={item.avatarUrl} supportingText={item.supportingText} isDisabled={item.isDisabled}>
                                {item.label}
                            </Select.Item>
                        )}
                    </Select>
                </Labelled>
                <Labelled label="Item icons (one disabled)" className={W}>
                    <Select label="Product" placeholder="Choose a product" items={products} tooltip="Only products you are licensed for.">
                        {(item) => (
                            <Select.Item id={item.id} icon={item.icon} supportingText={item.supportingText} isDisabled={item.isDisabled}>
                                {item.label}
                            </Select.Item>
                        )}
                    </Select>
                </Labelled>
                <Labelled label="Leading icon on trigger" className={W}>
                    <Select
                        label="Client type"
                        placeholder="Select"
                        icon={User01}
                        items={[
                            { id: "ind", label: "Individual" },
                            { id: "joint", label: "Joint" },
                            { id: "trust", label: "Trust" },
                            { id: "co", label: "Company" },
                        ]}
                    >
                        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                    </Select>
                </Labelled>
            </Demo>

            <Demo title="States" className="items-start">
                <Labelled label="isRequired + isInvalid" className={W}>
                    <Select isRequired isInvalid label="Province" placeholder="Select a province" hint="Please choose a province." items={provinces}>
                        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                    </Select>
                </Labelled>
                <Labelled label="isDisabled" className={W}>
                    <Select isDisabled label="Province" defaultSelectedKey="wc" items={provinces}>
                        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                    </Select>
                </Labelled>
            </Demo>
        </ShowcaseSection>
    );
};

const SelectItemSection = () => (
    <ShowcaseSection
        id="form-select-item"
        title="SelectItem"
        description="The list row shared by Select, ComboBox, MultiSelect and TagSelect. Selection indicator can be a checkmark, checkbox or none, aligned left or right."
        importPath="base/select/select-item"
        exports={["SelectItem"]}
    >
        <Demo className="items-start">
            {(
                [
                    ["checkmark", "right"],
                    ["checkbox", "left"],
                    ["checkbox", "right"],
                    ["none", "right"],
                ] as const
            ).map(([indicator, align]) => (
                <Labelled key={indicator + align} label={`selectionIndicator="${indicator}" align="${align}"`} className="w-full sm:w-64">
                    <div className="rounded-lg bg-primary py-1 ring-1 ring-secondary_alt">
                        <AriaListBox
                            aria-label={`Products (${indicator})`}
                            selectionMode="multiple"
                            defaultSelectedKeys={["ra", "tfsa"]}
                            className="outline-hidden"
                        >
                            {products.slice(0, 4).map((item) => (
                                <SelectItem
                                    key={item.id}
                                    id={item.id}
                                    label={item.label}
                                    icon={indicator === "checkbox" ? undefined : item.icon}
                                    selectionIndicator={indicator}
                                    selectionIndicatorAlign={align}
                                />
                            ))}
                        </AriaListBox>
                    </div>
                </Labelled>
            ))}
        </Demo>
    </ShowcaseSection>
);

const ComboBoxSection = () => (
    <ShowcaseSection
        id="form-combobox"
        title="ComboBox"
        description="Searchable select: type to filter the list. Also available as Select.ComboBox."
        importPath="base/select/combobox"
        exports={["ComboBox"]}
    >
        <Demo className="items-start">
            {(["sm", "md", "lg"] as const).map((size) => (
                <Labelled key={size} label={`size="${size}"${size === "md" ? " (default, ⌘K shortcut)" : ""}`} className={W}>
                    <ComboBox size={size} label="Adviser" placeholder="Search advisers" items={advisers} shortcut={size === "md"}>
                        {(item) => (
                            <SelectItem id={item.id} avatarUrl={item.avatarUrl} supportingText={item.supportingText} isDisabled={item.isDisabled}>
                                {item.label}
                            </SelectItem>
                        )}
                    </ComboBox>
                </Labelled>
            ))}
            <Labelled label="Custom icon, hint" className={W}>
                <Select.ComboBox
                    label="Province"
                    placeholder="Type a province"
                    icon={MarkerPin01}
                    shortcut={false}
                    items={provinces}
                    hint="Via Select.ComboBox."
                >
                    {(item) => (
                        <Select.Item id={item.id} supportingText={item.supportingText}>
                            {item.label}
                        </Select.Item>
                    )}
                </Select.ComboBox>
            </Labelled>
            <Labelled label="isDisabled" className={W}>
                <ComboBox isDisabled label="Adviser" items={advisers}>
                    {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
                </ComboBox>
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

const MultiSelectSection = () => {
    const [selected, setSelected] = useState<Selection>(new Set(["gp", "wc"]));
    const [team, setTeam] = useState<Selection>(new Set());

    return (
        <ShowcaseSection
            id="form-multi-select"
            title="MultiSelect"
            description="Checkbox list in a popover with a search field, empty state, and a footer to reset or select all."
            importPath="base/select/multi-select"
            exports={["MultiSelect"]}
        >
            <Demo className="items-start">
                <Labelled label="Search + footer, controlled" className={W}>
                    <MultiSelect
                        label="Provinces covered"
                        placeholder="Select provinces"
                        items={provinces}
                        selectedKeys={selected}
                        onSelectionChange={setSelected}
                        onReset={() => setSelected(new Set())}
                        onSelectAll={() => setSelected(new Set(provinces.map((p) => p.id)))}
                        icon={MarkerPin01}
                        hint="Try searching for something that does not exist to see the empty state."
                    >
                        {(item) => (
                            <MultiSelect.Item id={item.id} supportingText={item.supportingText} selectionIndicator="checkbox" selectionIndicatorAlign="left">
                                {item.label}
                            </MultiSelect.Item>
                        )}
                    </MultiSelect>
                </Labelled>
                <Labelled label="Avatars, no search/footer, custom count" className={W}>
                    <MultiSelect
                        size="sm"
                        label="Advice team"
                        placeholder="Add advisers"
                        items={advisers}
                        selectedKeys={team}
                        onSelectionChange={setTeam}
                        showSearch={false}
                        showFooter={false}
                        selectedCountFormatter={(n) => `${n} adviser${n === 1 ? "" : "s"}`}
                    >
                        {(item) => (
                            <MultiSelect.Item id={item.id} avatarUrl={item.avatarUrl} isDisabled={item.isDisabled} selectionIndicator="checkbox">
                                {item.label}
                            </MultiSelect.Item>
                        )}
                    </MultiSelect>
                </Labelled>
                <Labelled label='size="lg", isInvalid' className={W}>
                    <MultiSelect size="lg" isRequired isInvalid label="Products" items={products} hint="Select at least one product.">
                        {(item) => (
                            <MultiSelect.Item id={item.id} icon={item.icon} isDisabled={item.isDisabled}>
                                {item.label}
                            </MultiSelect.Item>
                        )}
                    </MultiSelect>
                </Labelled>
                <Labelled label="isDisabled" className={W}>
                    <MultiSelect isDisabled label="Products" items={products}>
                        {(item) => <MultiSelect.Item id={item.id}>{item.label}</MultiSelect.Item>}
                    </MultiSelect>
                </Labelled>
            </Demo>
            <Demo title="MultiSelect.EmptyState & MultiSelect.Footer on their own" className="items-start">
                <div className="w-full rounded-lg bg-primary ring-1 ring-secondary_alt sm:w-80">
                    <MultiSelect.EmptyState title="No advisers found" description="Try a different name or branch." onClearSearch={() => {}} />
                    <MultiSelect.Footer size="md" />
                </div>
            </Demo>
        </ShowcaseSection>
    );
};

const TagSelectSection = () => {
    const selected = useListData<SelectItemType>({ initialItems: [advisers[0], advisers[2]] });
    const selectedSm = useListData<SelectItemType>({ initialItems: [] });

    return (
        <ShowcaseSection
            id="form-tag-select"
            title="TagSelect"
            description="Searchable multi-select that shows each choice as a removable tag inside the field. Selection lives in a react-stately useListData list."
            importPath="base/select/tag-select"
            exports={["TagSelect"]}
        >
            <Demo className="items-start">
                <Labelled label='size="md", avatars, shortcut' className="w-full sm:w-96">
                    <TagSelect
                        size="md"
                        shortcut
                        label="Advisers on this case"
                        placeholder="Search advisers"
                        items={advisers}
                        selectedItems={selected}
                        hint={`${selected.items.length} selected`}
                    >
                        {(item) => (
                            <TagSelect.Item id={item.id} avatarUrl={item.avatarUrl} supportingText={item.supportingText} isDisabled={item.isDisabled}>
                                {item.label}
                            </TagSelect.Item>
                        )}
                    </TagSelect>
                </Labelled>
                <Labelled label='size="sm" (default)' className="w-full sm:w-96">
                    <TagSelect label="Provinces" placeholder="Search provinces" items={provinces} selectedItems={selectedSm}>
                        {(item) => (
                            <TagSelect.Item id={item.id} supportingText={item.supportingText}>
                                {item.label}
                            </TagSelect.Item>
                        )}
                    </TagSelect>
                </Labelled>
            </Demo>
        </ShowcaseSection>
    );
};

const NativeSelectSection = () => {
    const [risk, setRisk] = useState("moderate");
    const options = [
        { label: "Conservative", value: "conservative" },
        { label: "Moderate", value: "moderate" },
        { label: "Moderately aggressive", value: "mod-aggressive" },
        { label: "Aggressive", value: "aggressive" },
    ];

    return (
        <ShowcaseSection
            id="form-native-select"
            title="NativeSelect"
            description="A styled native <select>, best on mobile and inside InputGroup addons."
            importPath="base/select/select-native"
            exports={["NativeSelect"]}
        >
            <Demo className="items-start">
                {(["sm", "md", "lg"] as const).map((size) => (
                    <Labelled key={size} label={`size="${size}"`} className={W}>
                        <NativeSelect size={size} label="Risk profile" hint="From the latest risk questionnaire." options={options} defaultValue="moderate" />
                    </Labelled>
                ))}
                <Labelled label="Controlled" className={W}>
                    <NativeSelect label="Risk profile" options={options} value={risk} onChange={(e) => setRisk(e.target.value)} hint={`Value: ${risk}`} />
                </Labelled>
                <Labelled label="disabled" className={W}>
                    <NativeSelect disabled label="Risk profile" options={options} defaultValue="conservative" />
                </Labelled>
            </Demo>
        </ShowcaseSection>
    );
};

const PopoverSection = () => (
    <ShowcaseSection
        id="form-popover"
        title="Popover (select)"
        description="The animated, trigger-width popover Select and ComboBox render their list into. It can host any listbox or dialog content under a React Aria trigger."
        importPath="base/select/popover"
        exports={["Popover"]}
    >
        <Demo className="items-start">
            <Labelled label="DialogTrigger + Popover + SelectItem list">
                <AriaDialogTrigger>
                    <Button color="secondary" size="md" iconLeading={Users01}>
                        Choose adviser
                    </Button>
                    <Popover size="md" placement="bottom start" className="w-72">
                        <AriaDialog aria-label="Advisers" className="outline-hidden">
                            <AriaListBox
                                aria-label="Advisers"
                                selectionMode="single"
                                defaultSelectedKeys={["pieter"]}
                                items={advisers}
                                className="outline-hidden"
                            >
                                {(item) => (
                                    <SelectItem id={item.id} avatarUrl={item.avatarUrl} supportingText={item.supportingText} isDisabled={item.isDisabled}>
                                        {item.label}
                                    </SelectItem>
                                )}
                            </AriaListBox>
                        </AriaDialog>
                    </Popover>
                </AriaDialogTrigger>
            </Labelled>
            <Labelled label='size="sm" (max-h-56, scrolls)'>
                <AriaDialogTrigger>
                    <Button color="secondary" size="sm" iconLeading={MarkerPin01}>
                        Province
                    </Button>
                    <Popover size="sm" placement="bottom start" className="w-56">
                        <AriaDialog aria-label="Provinces" className="outline-hidden">
                            <AriaListBox aria-label="Provinces" selectionMode="single" items={provinces} className="outline-hidden">
                                {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
                            </AriaListBox>
                        </AriaDialog>
                    </Popover>
                </AriaDialogTrigger>
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

/* -------------------------------------------------------------------------- */
/*                              Form & file upload                            */
/* -------------------------------------------------------------------------- */

const FormSection = () => {
    const [submitted, setSubmitted] = useState<Record<string, string> | null>(null);

    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
        setSubmitted(data);
    };

    return (
        <ShowcaseSection
            id="form-form"
            title="Form"
            description="React Aria Form: native validation, and every field's required / type rules are checked on submit. Try submitting empty."
            importPath="base/form/form"
            exports={["Form"]}
        >
            <Demo title="New client enquiry" className="items-start">
                <Form onSubmit={onSubmit} onReset={() => setSubmitted(null)} className="flex w-full max-w-lg flex-col gap-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input isRequired name="firstName" label="First name" placeholder="Nomvula" />
                        <Input isRequired name="lastName" label="Surname" placeholder="Dlamini" />
                    </div>
                    <Input isRequired name="email" type="email" label="Email" placeholder="client@example.co.za" icon={Mail01} />
                    <Select isRequired name="province" label="Province" placeholder="Select a province" items={provinces}>
                        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                    </Select>
                    <InputNumber
                        name="amount"
                        label="Amount to invest"
                        defaultValue={250000}
                        minValue={0}
                        step={5000}
                        formatOptions={{ style: "currency", currency: "ZAR", maximumFractionDigits: 0 }}
                    />
                    <TextArea name="message" label="How can we help?" placeholder="I would like advice on…" rows={3} />
                    <div className="flex gap-3">
                        <Button type="submit" size="md">
                            Send enquiry
                        </Button>
                        <Button type="reset" size="md" color="secondary">
                            Reset
                        </Button>
                    </div>
                    {submitted && (
                        <pre className="overflow-x-auto rounded-lg bg-secondary p-3 font-mono text-xs text-secondary">{JSON.stringify(submitted, null, 2)}</pre>
                    )}
                </Form>
            </Demo>
        </ShowcaseSection>
    );
};

const FileTriggerSection = () => {
    const [files, setFiles] = useState<string[]>([]);

    return (
        <ShowcaseSection
            id="form-file-trigger"
            title="FileTrigger"
            description="Turns any single pressable child into a file picker. Supports accepted types, multiple files, directory selection and camera capture."
            importPath="base/file-upload-trigger/file-upload-trigger"
            exports={["FileTrigger"]}
        >
            <Demo className="items-start">
                <Labelled label="acceptedFileTypes (PDF), allowsMultiple">
                    <FileTrigger
                        acceptedFileTypes={["application/pdf"]}
                        allowsMultiple
                        onSelect={(list) => setFiles(list ? Array.from(list, (f) => f.name) : [])}
                    >
                        <Button color="secondary" size="md" iconLeading={UploadCloud02}>
                            Upload statements
                        </Button>
                    </FileTrigger>
                    <Caption>{files.length ? files.join(", ") : "No files selected."}</Caption>
                </Labelled>
                <Labelled label="acceptDirectory">
                    <FileTrigger acceptDirectory onSelect={() => {}}>
                        <Button color="tertiary" size="md" iconLeading={File06}>
                            Upload a folder
                        </Button>
                    </FileTrigger>
                </Labelled>
                <Labelled label='defaultCamera="environment" (mobile)'>
                    <FileTrigger defaultCamera="environment" acceptedFileTypes={["image/*"]} onSelect={() => {}}>
                        <Button color="link-color" size="md">
                            Photograph your ID
                        </Button>
                    </FileTrigger>
                </Labelled>
            </Demo>
        </ShowcaseSection>
    );
};

/* -------------------------------------------------------------------------- */
/*                                  Dropdowns                                 */
/* -------------------------------------------------------------------------- */

const SectionHeader = ({ children }: { children: ReactNode }) => (
    <Dropdown.SectionHeader className="px-4 pt-1.5 pb-0.5 text-xs font-semibold text-tertiary">{children}</Dropdown.SectionHeader>
);

const DropdownPrimitivesSection = () => {
    const [view, setView] = useState<Selection>(new Set(["list"]));
    const [columns, setColumns] = useState<Selection>(new Set(["value", "return"]));
    const [alerts, setAlerts] = useState<Selection>(new Set(["email"]));
    const [lastAction, setLastAction] = useState<string>("none");

    return (
        <ShowcaseSection
            id="form-dropdown"
            title="Dropdown primitives"
            description="Dropdown.Root (MenuTrigger), Popover, Menu, Section, SectionHeader, Item, Separator and DotsButton. Items can have icons, avatars, keyboard addons, submenus and checkmark / checkbox / radio / toggle selection."
            importPath="base/dropdown/dropdown"
            exports={["Dropdown"]}
        >
            <Demo className="items-start">
                <Labelled label="Icons, addons, submenu, onAction">
                    <Dropdown.Root>
                        <Button color="secondary" size="md">
                            Portfolio actions
                        </Button>
                        <Dropdown.Popover>
                            <Dropdown.Menu onAction={(key) => setLastAction(String(key))}>
                                <Dropdown.Section>
                                    <Dropdown.Item id="edit" icon={Edit04} addon="⌘E">
                                        Edit portfolio
                                    </Dropdown.Item>
                                    <Dropdown.Item id="duplicate" icon={Copy01} addon="⌘D">
                                        Duplicate
                                    </Dropdown.Item>
                                    <SubmenuTrigger>
                                        <Dropdown.Item id="share" icon={Share07}>
                                            Share with
                                        </Dropdown.Item>
                                        <Dropdown.Popover placement="right top" offset={-6} className="w-56">
                                            <Dropdown.Menu onAction={(key) => setLastAction(`share:${String(key)}`)}>
                                                <Dropdown.Item id="client" icon={User01}>
                                                    Client
                                                </Dropdown.Item>
                                                <Dropdown.Item id="accountant" icon={Briefcase01}>
                                                    Accountant
                                                </Dropdown.Item>
                                            </Dropdown.Menu>
                                        </Dropdown.Popover>
                                    </SubmenuTrigger>
                                </Dropdown.Section>
                                <Dropdown.Separator />
                                <Dropdown.Section>
                                    <Dropdown.Item id="archive" icon={Archive}>
                                        Archive
                                    </Dropdown.Item>
                                    <Dropdown.Item id="delete" icon={Trash01} isDisabled>
                                        Delete (disabled)
                                    </Dropdown.Item>
                                </Dropdown.Section>
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown.Root>
                    <Caption>Last action: {lastAction}</Caption>
                </Labelled>

                <Labelled label="Selection indicators">
                    <Dropdown.Root>
                        <Button color="secondary" size="md">
                            View options
                        </Button>
                        <Dropdown.Popover className="w-64">
                            <Dropdown.Menu aria-label="View options">
                                <Dropdown.Section selectionMode="single" selectedKeys={view} onSelectionChange={setView}>
                                    <SectionHeader>Layout (checkmark)</SectionHeader>
                                    <Dropdown.Item id="list">List</Dropdown.Item>
                                    <Dropdown.Item id="grid">Grid</Dropdown.Item>
                                </Dropdown.Section>
                                <Dropdown.Separator />
                                <Dropdown.Section selectionMode="multiple" selectedKeys={columns} onSelectionChange={setColumns}>
                                    <SectionHeader>Columns (checkbox)</SectionHeader>
                                    <Dropdown.Item id="value" selectionIndicator="checkbox">
                                        Market value
                                    </Dropdown.Item>
                                    <Dropdown.Item id="return" selectionIndicator="checkbox">
                                        1-year return
                                    </Dropdown.Item>
                                    <Dropdown.Item id="fees" selectionIndicator="checkbox">
                                        Fees
                                    </Dropdown.Item>
                                </Dropdown.Section>
                                <Dropdown.Separator />
                                <Dropdown.Section selectionMode="single" defaultSelectedKeys={["monthly"]}>
                                    <SectionHeader>Frequency (radio)</SectionHeader>
                                    <Dropdown.Item id="monthly" selectionIndicator="radio">
                                        Monthly
                                    </Dropdown.Item>
                                    <Dropdown.Item id="quarterly" selectionIndicator="radio">
                                        Quarterly
                                    </Dropdown.Item>
                                </Dropdown.Section>
                                <Dropdown.Separator />
                                <Dropdown.Section selectionMode="multiple" selectedKeys={alerts} onSelectionChange={setAlerts}>
                                    <SectionHeader>Alerts (toggle)</SectionHeader>
                                    <Dropdown.Item id="email" selectionIndicator="toggle">
                                        Email
                                    </Dropdown.Item>
                                    <Dropdown.Item id="sms" selectionIndicator="toggle">
                                        SMS
                                    </Dropdown.Item>
                                </Dropdown.Section>
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown.Root>
                </Labelled>

                <Labelled label="Avatar items + DotsButton trigger">
                    <Dropdown.Root>
                        <Dropdown.DotsButton />
                        <Dropdown.Popover className="w-64">
                            <Dropdown.Menu selectionMode="single" defaultSelectedKeys={["thandi"]} aria-label="Reassign client">
                                <Dropdown.Section>
                                    <SectionHeader>Reassign to</SectionHeader>
                                    {advisers.slice(0, 4).map((a) => (
                                        <Dropdown.Item key={a.id} id={a.id} avatarUrl={a.avatarUrl} label={a.label} />
                                    ))}
                                </Dropdown.Section>
                                <Dropdown.Separator />
                                <Dropdown.Item id="new" icon={Plus} selectionIndicator="none">
                                    Add adviser
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown.Root>
                </Labelled>
            </Demo>
        </ShowcaseSection>
    );
};

const Prebuilt = ({ label, children }: { label: string; children: ReactNode }) => (
    <Labelled label={label} className="min-w-40">
        <div className="flex min-h-10 items-center">{children}</div>
    </Labelled>
);

const DropdownAccountSection = () => (
    <ShowcaseSection
        id="form-dropdown-account"
        title="Account dropdowns"
        description="Prebuilt account switchers: breadcrumb, button, cards in three sizes and an avatar trigger. They ship with the kit's own sample people and avatars."
        importPath="base/dropdown/dropdown-account-*"
        exports={[
            "DropdownAccountBreadcrumb",
            "DropdownAccountButton",
            "DropdownAccountCardXS",
            "DropdownAccountCardSM",
            "DropdownAccountCardMD",
            "DropdownAvatar",
        ]}
    >
        <Demo className="items-start">
            <Prebuilt label="DropdownAccountBreadcrumb">
                <DropdownAccountBreadcrumb />
            </Prebuilt>
            <Prebuilt label="DropdownAccountButton">
                <DropdownAccountButton />
            </Prebuilt>
            <Prebuilt label="DropdownAvatar">
                <DropdownAvatar />
            </Prebuilt>
        </Demo>
        <Demo title="Account cards" className="items-start">
            <Prebuilt label="DropdownAccountCardXS">
                <DropdownAccountCardXS />
            </Prebuilt>
            <Prebuilt label="DropdownAccountCardSM">
                <DropdownAccountCardSM />
            </Prebuilt>
            <Prebuilt label="DropdownAccountCardMD">
                <DropdownAccountCardMD />
            </Prebuilt>
        </Demo>
    </ShowcaseSection>
);

const DropdownButtonSection = () => (
    <ShowcaseSection
        id="form-dropdown-button"
        title="Button dropdowns"
        description="Prebuilt menus triggered by a button: simple, advanced (with sections and selection) and link-style."
        importPath="base/dropdown/dropdown-button-*"
        exports={["DropdownButtonSimple", "DropdownButtonAdvanced", "DropdownButtonLink"]}
    >
        <Demo className="items-start">
            <Prebuilt label="DropdownButtonSimple">
                <DropdownButtonSimple />
            </Prebuilt>
            <Prebuilt label="DropdownButtonAdvanced">
                <DropdownButtonAdvanced />
            </Prebuilt>
            <Prebuilt label="DropdownButtonLink">
                <DropdownButtonLink />
            </Prebuilt>
        </Demo>
    </ShowcaseSection>
);

const DropdownIconSection = () => (
    <ShowcaseSection
        id="form-dropdown-icon"
        title="Icon dropdowns"
        description="Prebuilt menus triggered by an icon-only button, simple and advanced."
        importPath="base/dropdown/dropdown-icon-*"
        exports={["DropdownIconSimple", "DropdownIconAdvanced"]}
    >
        <Demo className="items-start">
            <Prebuilt label="DropdownIconSimple">
                <DropdownIconSimple />
            </Prebuilt>
            <Prebuilt label="DropdownIconAdvanced">
                <DropdownIconAdvanced />
            </Prebuilt>
        </Demo>
    </ShowcaseSection>
);

const DropdownContextSection = () => (
    <ShowcaseSection
        id="form-dropdown-context-menu"
        title="Context menus"
        description='Menus opened by right-click (trigger="contextMenu") on an area, simple and advanced with submenus and toggles.'
        importPath="base/dropdown/dropdown-context-menu-*"
        exports={["DropdownContextMenuSimple", "DropdownContextMenuAdvanced"]}
    >
        <Demo className="items-start">
            <Labelled label="DropdownContextMenuSimple" className="w-full sm:w-80">
                <DropdownContextMenuSimple />
            </Labelled>
            <Labelled label="DropdownContextMenuAdvanced" className="w-full sm:w-80">
                <DropdownContextMenuAdvanced />
            </Labelled>
        </Demo>
    </ShowcaseSection>
);

const DropdownSearchSection = () => (
    <ShowcaseSection
        id="form-dropdown-search"
        title="Search dropdowns"
        description="Menus with a filter field at the top (React Aria Autocomplete) and multi-select checkboxes."
        importPath="base/dropdown/dropdown-search-*"
        exports={["DropdownSearchSimple", "DropdownSearchAdvanced"]}
    >
        <Demo className="items-start">
            <Prebuilt label="DropdownSearchSimple">
                <DropdownSearchSimple />
            </Prebuilt>
            <Prebuilt label="DropdownSearchAdvanced">
                <DropdownSearchAdvanced />
            </Prebuilt>
        </Demo>
    </ShowcaseSection>
);

const DropdownIntegrationSection = () => (
    <ShowcaseSection
        id="form-dropdown-integration"
        title="Integration dropdown"
        description="A copy / open-in menu with third-party integration icons."
        importPath="base/dropdown/dropdown-integration"
        exports={["DropdownIntegration"]}
    >
        <Demo className="items-start">
            <Prebuilt label="DropdownIntegration">
                <DropdownIntegration />
            </Prebuilt>
        </Demo>
    </ShowcaseSection>
);

/* -------------------------------------------------------------------------- */
/*                                    Group                                   */
/* -------------------------------------------------------------------------- */

const SECTIONS: { id: string; title: string; Component: () => ReactNode }[] = [
    { id: "form-input", title: "Input & TextField", Component: InputSection },
    { id: "form-input-group", title: "InputGroup & InputPrefix", Component: InputGroupSection },
    { id: "form-input-date", title: "InputDate", Component: InputDateSection },
    { id: "form-input-file", title: "InputFile", Component: InputFileSection },
    { id: "form-input-number", title: "InputNumber", Component: InputNumberSection },
    { id: "form-payment-input", title: "PaymentInput", Component: PaymentInputSection },
    { id: "form-input-tags", title: "InputTags", Component: InputTagsSection },
    { id: "form-input-tags-outer", title: "InputTagsOuter", Component: InputTagsOuterSection },
    { id: "form-label-hint", title: "Label & HintText", Component: LabelHintSection },
    { id: "form-pin-input", title: "PinInput", Component: PinInputSection },
    { id: "form-textarea", title: "TextArea", Component: TextAreaSection },
    { id: "form-select", title: "Select", Component: SelectSection },
    { id: "form-select-item", title: "SelectItem", Component: SelectItemSection },
    { id: "form-combobox", title: "ComboBox", Component: ComboBoxSection },
    { id: "form-multi-select", title: "MultiSelect", Component: MultiSelectSection },
    { id: "form-tag-select", title: "TagSelect", Component: TagSelectSection },
    { id: "form-native-select", title: "NativeSelect", Component: NativeSelectSection },
    { id: "form-popover", title: "Popover (select)", Component: PopoverSection },
    { id: "form-form", title: "Form", Component: FormSection },
    { id: "form-file-trigger", title: "FileTrigger", Component: FileTriggerSection },
    { id: "form-dropdown", title: "Dropdown primitives", Component: DropdownPrimitivesSection },
    { id: "form-dropdown-account", title: "Account dropdowns", Component: DropdownAccountSection },
    { id: "form-dropdown-button", title: "Button dropdowns", Component: DropdownButtonSection },
    { id: "form-dropdown-icon", title: "Icon dropdowns", Component: DropdownIconSection },
    { id: "form-dropdown-context-menu", title: "Context menus", Component: DropdownContextSection },
    { id: "form-dropdown-search", title: "Search dropdowns", Component: DropdownSearchSection },
    { id: "form-dropdown-integration", title: "Integration dropdown", Component: DropdownIntegrationSection },
];

const FormsSections = () => (
    <>
        {SECTIONS.map(({ id, Component }) => (
            <Component key={id} />
        ))}
    </>
);

export const formsGroup: ShowcaseGroup = {
    id: "forms",
    title: "Forms, inputs & menus",
    description:
        "Everything a client or adviser types into or picks from: text, number, date, card and PIN inputs, tags, selects and comboboxes, form and file helpers, and every dropdown menu.",
    entries: SECTIONS.map(({ id, title }) => ({ id, title })),
    Component: FormsSections,
};
