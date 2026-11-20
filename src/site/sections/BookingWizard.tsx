/**
 * BookingWizard — the booking itself: five legs (how to meet, the day, the
 * time, your details, review), then the confirmation in place, with the
 * running summary beside it.
 *
 * It offers exactly what the live booking (ConsultationModal) offers, from the
 * module both read (consultationBooking.ts): the three meeting formats, the
 * bookable days and the half-hour slots. It sends exactly what the live
 * booking sends, through the same client call:
 * POST /consultation/request with the name, email and phone as typed, the
 * meeting format, the day and time as preferred slot 1, empty slots 2 and 3,
 * and the notes.
 *
 * Like the other Navigator forms it says what is missing beside the field and
 * moves focus there, shows a failed send in the form rather than a passing
 * toast, and confirms in place. Continue keeps the board's disabled look until
 * a leg is complete, but stays focusable, so activating it early explains
 * what is needed instead of doing nothing.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import {
  MEETING_TYPES,
  STEPS,
  formatTimeLabel,
  generateTimeSlots,
  type MeetingTypeId,
} from '../../components/modals/consultationBooking';
import { api } from '../../utils/api/client';
import {
  getBlockedEmailDomain,
  getBlockedEmailDomainWarning,
} from '../../shared/submissions/blockedEmailDomains';
import { BookingCalendar } from './BookingCalendar';
import { MeetingChoice, TimeChoice, type MeetingOption } from './BookingChoices';
import { BookingDetails } from './BookingDetails';
import {
  DETAILS_ORDER,
  fieldId,
  validateDetails,
  type DetailsField,
  type DetailsValues,
} from './bookingRules';
import { BookingIcon, type BookingIconName } from './BookingIcons';
import { BookingSummary } from './BookingSummary';

/** The board's name for each leg, above the progress bars. */
const LEG_TITLES = ['Meeting type', 'Date', 'Time', 'Your details', 'Review'];

const TYPE_ICONS: Record<MeetingTypeId, BookingIconName> = {
  virtual: 'video',
  telephonic: 'phone',
  in_person: 'mapPin',
};

const OPTIONS: MeetingOption[] = MEETING_TYPES.map((m) => ({
  id: m.id,
  title: m.title,
  subtitle: m.subtitle,
  detail: m.detail,
  icon: TYPE_ICONS[m.id],
}));

const SLOTS = generateTimeSlots().map((value) => ({ value, label: formatTimeLabel(value) }));

const EMPTY: DetailsValues = { name: '', email: '', phone: '', notes: '' };

const TRUST: readonly { label: string; icon: BookingIconName }[] = [
  { label: 'Free consultation', icon: 'shield' },
  { label: 'No obligation', icon: 'checkCircle' },
  { label: 'Expert advice', icon: 'sparkles' },
];

const DATE_ERROR_ID = 'nwbk-date-error';
const TIME_ERROR_ID = 'nwbk-time-error';

const longDate = (d: Date) => format(d, 'EEEE, d MMMM yyyy');

interface BookingWizardProps {
  /** The firm's business hours, as "Monday – Friday, 08:30 – 16:30". */
  hours: string;
  notice: string;
  /** The failure message's fallback names the firm's number. */
  phoneDisplay: string;
  phoneHref: string;
  whatsappHref: string;
  /** "What happens next", in order. */
  nextSteps: readonly string[];
}

export function BookingWizard({
  hours,
  notice,
  phoneDisplay,
  phoneHref,
  whatsappHref,
  nextSteps,
}: BookingWizardProps) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<MeetingTypeId>('virtual');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState('');
  const [month, setMonth] = useState(0);
  const [values, setValues] = useState<DetailsValues>(EMPTY);
  const [tried, setTried] = useState<Record<number, boolean>>({});
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState('');
  const [done, setDone] = useState(false);

  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const dayStop = useRef<HTMLButtonElement | null>(null);
  const slotStop = useRef<HTMLButtonElement | null>(null);

  // Each leg, and the confirmation, takes focus once the visitor moves to it,
  // so a screen reader announces where they are. Not on first load.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    heading.current?.focus();
  }, [step, done]);

  const meeting = MEETING_TYPES.find((m) => m.id === type) ?? MEETING_TYPES[0];
  const dateLabel = date ? longDate(date) : '';
  const timeLabel = time ? formatTimeLabel(time) : '';
  const blockedDomain = getBlockedEmailDomain(values.email);
  const blockedText = blockedDomain ? getBlockedEmailDomainWarning(blockedDomain) : undefined;
  const filled = !!(values.name.trim() && values.email.trim() && values.phone.trim());
  const can = [true, !!date, !!time, filled && !blockedDomain, true][step];
  const detailErrors = tried[3] ? validateDetails(values) : {};

  const go = (next: number) => {
    moved.current = true;
    setFailure('');
    setStep(next);
  };

  const onChange = (field: DetailsField, value: string) =>
    setValues((v) => ({ ...v, [field]: value }));

  const submit = async () => {
    if (!date || !time || sending) return;
    if (blockedDomain) {
      setFailure(blockedText ?? '');
      return;
    }
    setSending(true);
    setFailure('');
    try {
      await api.post(
        '/consultation/request',
        {
          name: values.name,
          email: values.email,
          phone: values.phone,
          meetingType: type,
          preferredDate1: format(date, 'yyyy-MM-dd'),
          preferredTime1: time,
          preferredDate2: '',
          preferredTime2: '',
          preferredDate3: '',
          preferredTime3: '',
          additionalNotes: values.notes,
        },
        { retryTransientFailures: false },
      );
      moved.current = true;
      setDone(true);
    } catch (error) {
      setFailure(
        error instanceof Error && error.message
          ? error.message
          : `Failed to book consultation. Please try again or contact us directly at ${phoneDisplay}.`,
      );
    } finally {
      setSending(false);
    }
  };

  const next = () => {
    if (step === 4) {
      void submit();
      return;
    }
    if (!can || step === 3) {
      setTried((t) => ({ ...t, [step]: true }));
      if (step === 1) {
        dayStop.current?.focus();
        return;
      }
      if (step === 2) {
        slotStop.current?.focus();
        return;
      }
      if (step === 3) {
        const errors = validateDetails(values);
        const first = DETAILS_ORDER.find((f) => errors[f]) ?? (blockedDomain ? 'email' : null);
        if (first) {
          document.getElementById(fieldId(first))?.focus();
          return;
        }
      }
    }
    go(step + 1);
  };

  const reset = () => {
    moved.current = true;
    setStep(0);
    setType('virtual');
    setDate(undefined);
    setTime('');
    setMonth(0);
    setValues(EMPTY);
    setTried({});
    setFailure('');
    setDone(false);
  };

  const stepHead = (title: string, sub: string) => (
    <div>
      <h2 ref={heading} tabIndex={-1} className="nwbk-step-title">
        {title}
      </h2>
      <p className="nwbk-step-sub">{sub}</p>
    </div>
  );

  const reviewRow = (label: string, icon: BookingIconName, dd: ReactNode, top = false) => (
    <div className={top ? 'nwbk-review-row nwbk-review-row--top' : 'nwbk-review-row'}>
      <dt className="nw-mono nwbk-review-dt">
        <span className="nwbk-review-icon" aria-hidden="true">
          <BookingIcon name={icon} size={17} />
        </span>
        {label}
      </dt>
      {dd}
    </div>
  );

  return (
    <section id="booking" className="nwbk-booking">
      <div className="nw-wrap nwbk-booking-row">
        <div className="nwbk-card">
          {done ? (
            <div className="nwbk-done">
              <span className="nwbk-done-icon" aria-hidden="true">
                <BookingIcon name="checkCircle" size={40} />
              </span>
              <h2 ref={heading} tabIndex={-1} className="nwbk-done-title">
                Request Received!
              </h2>
              <p className="nwbk-done-text">
                We&apos;ve received your request and sent a confirmation to{' '}
                <strong>{values.email}</strong>.
              </p>
              <p className="nwbk-done-text nwbk-done-text--tight">
                We will contact you within 24 hours on business days to confirm your appointment.
              </p>
              <div className="nwbk-done-box">
                {/* The meeting format's own icon (the board always drew the video one). */}
                <span>
                  <BookingIcon name={TYPE_ICONS[meeting.id]} size={16} stroke="#0D1626" />
                  {meeting.title}
                </span>
                <span>
                  <BookingIcon name="calendar" size={16} stroke="#0D1626" />
                  {dateLabel}
                </span>
                {/* The board sets the time and "(SAST)" apart by the row's gap. */}
                <span>
                  <BookingIcon name="clock" size={16} stroke="#0D1626" />
                  <span>{timeLabel}</span> <span>(SAST)</span>
                </span>
              </div>
              <button type="button" className="nw-btn nwbk-done-btn" onClick={reset}>
                Done
              </button>
            </div>
          ) : (
            <div>
              <div className="nwbk-legs">
                <div className="nwbk-legs-head">
                  <span className="nwbk-legs-title">{LEG_TITLES[step]}</span>
                  <span className="nw-mono nwbk-legs-count">
                    LEG {step + 1} OF {STEPS.length}
                  </span>
                </div>
                <ol aria-label="Booking steps" className="nwbk-legs-list">
                  {STEPS.map((s, i) => (
                    <li
                      key={s.id}
                      aria-current={i === step ? 'step' : undefined}
                      className={i <= step ? 'nwbk-leg nwbk-leg--done' : 'nwbk-leg'}
                    >
                      <span className="nwbk-leg-bar" />
                      <span className="nw-mono nwbk-leg-label">{s.label}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="nwbk-body">
                {step === 0 ? (
                  <div className="nw-in nwbk-step nwbk-step--type">
                    {stepHead(
                      'How would you like to meet?',
                      'Choose your preferred consultation method',
                    )}
                    <MeetingChoice
                      options={OPTIONS}
                      value={type}
                      onChange={(id) => setType(id as MeetingTypeId)}
                    />
                    <div className="nwbk-info">
                      <BookingIcon name="clock" size={18} stroke="#1D4ED8" />
                      <div>
                        <p className="nwbk-info-title">Business Hours</p>
                        <p className="nwbk-info-text">
                          {hours} (SAST). {notice}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {step === 1 ? (
                  <div className="nw-in nwbk-step">
                    {stepHead('Select a date', 'Choose your preferred consultation date')}
                    <BookingCalendar
                      offset={month}
                      onOffset={setMonth}
                      selected={date}
                      onSelect={(d) => {
                        setDate(d);
                        setTime('');
                      }}
                      errorId={tried[1] && !date ? DATE_ERROR_ID : undefined}
                      focusRef={(el) => {
                        dayStop.current = el;
                      }}
                    />
                    {tried[1] && !date ? (
                      <p id={DATE_ERROR_ID} className="nwbk-field-error nwbk-field-error--center">
                        <BookingIcon name="alert" size={14} />
                        Please choose a date.
                      </p>
                    ) : null}
                    <p className="nwbk-cal-note">
                      Unavailable dates are greyed; days before today also show a strikethrough.
                    </p>
                    {date ? (
                      <div className="nwbk-cal-picked">
                        Selected: <strong>{dateLabel}</strong>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="nw-in nwbk-step">
                    {stepHead('Select a time', dateLabel)}
                    <TimeChoice
                      slots={SLOTS}
                      value={time}
                      onChange={setTime}
                      errorId={tried[2] && !time ? TIME_ERROR_ID : undefined}
                      focusRef={(el) => {
                        slotStop.current = el;
                      }}
                    />
                    {tried[2] && !time ? (
                      <p id={TIME_ERROR_ID} className="nwbk-field-error">
                        <BookingIcon name="alert" size={14} />
                        Please choose a time.
                      </p>
                    ) : null}
                    <p className="nw-mono nwbk-slots-note">
                      All times shown in South African Standard Time (SAST)
                    </p>
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="nw-in nwbk-step">
                    {stepHead('Your details', "We'll use this to confirm your appointment")}
                    <BookingDetails
                      values={values}
                      onChange={onChange}
                      errors={detailErrors}
                      blockedText={blockedText}
                    />
                  </div>
                ) : null}

                {step === 4 ? (
                  <div className="nw-in nwbk-step">
                    {stepHead('Review your booking', 'Please confirm the details below')}
                    <dl className="nwbk-review">
                      {/* The format's own icon (the board always drew the video one). */}
                      {reviewRow(
                        'Meeting Type',
                        TYPE_ICONS[meeting.id],
                        <dd className="nwbk-review-dd">{meeting.title}</dd>,
                      )}
                      {reviewRow(
                        'Date',
                        'calendar',
                        <dd className="nwbk-review-dd">{dateLabel}</dd>,
                      )}
                      {reviewRow(
                        'Time',
                        'clock',
                        <dd className="nwbk-review-dd">{timeLabel} (SAST)</dd>,
                      )}
                      {reviewRow(
                        'Contact',
                        'user',
                        <>
                          <dd className="nwbk-review-dd">{values.name}</dd>
                          <dd className="nwbk-review-dd nwbk-review-dd--sub">
                            {values.email} · {values.phone}
                          </dd>
                        </>,
                      )}
                      {values.notes.trim()
                        ? reviewRow(
                            'Notes',
                            'message',
                            <dd className="nwbk-review-dd nwbk-review-dd--notes">
                              {values.notes}
                            </dd>,
                            true,
                          )
                        : null}
                    </dl>
                    <ul className="nwbk-trust">
                      {TRUST.map((t) => (
                        <li key={t.label}>
                          <BookingIcon name={t.icon} size={18} stroke="#0D1626" />
                          {t.label}
                        </li>
                      ))}
                    </ul>
                    {failure ? (
                      <div className="nwbk-alert" role="alert">
                        <BookingIcon name="alert" size={16} />
                        <span>{failure}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="nwbk-foot">
                <button
                  type="button"
                  className={
                    step === 0 ? 'nw-outline nwbk-back nwbk-back--off' : 'nw-outline nwbk-back'
                  }
                  disabled={step === 0 || sending}
                  onClick={() => {
                    if (step > 0) go(step - 1);
                  }}
                >
                  <BookingIcon name="arrowLeft" size={16} />
                  Back
                </button>
                <button
                  type="button"
                  className={
                    can && !sending ? 'nw-btn nwbk-next' : 'nw-btn nwbk-next nwbk-next--off'
                  }
                  aria-disabled={!can || undefined}
                  disabled={sending}
                  onClick={next}
                >
                  {step === 4 ? (sending ? 'Booking…' : 'Confirm Booking') : 'Continue'}
                  <BookingIcon name="arrowRight" size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        <BookingSummary
          meeting={meeting.title}
          date={date ? dateLabel : null}
          time={time ? `${timeLabel} (SAST)` : null}
          steps={nextSteps}
          phoneHref={phoneHref}
          whatsappHref={whatsappHref}
        />
      </div>
    </section>
  );
}
