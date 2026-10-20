'use client';

/* admin.html's poll editor, as its own routes (decision 0026, D50): /admin/polls/new and
   /admin/polls/[id]/edit. Plain React state (D52), with the field rules and messages of the
   static page. They only help an admin fill the form in: the API decides, and its 422 field
   errors land on the same fields. Once anyone has answered, the questions are locked, as the
   API requires; leaving the editor discards its changes, as today (D55). */
import { IconArrowLeft, IconCalendar, IconHeading, IconLock, IconPlus, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react';

import { CARD } from '@/components/data/Notice';
import { FieldError, FormAlert, LABEL, SelectField, SettingsButton, TextField, type SelectOption } from '@/components/forms/Fields';
import { ApiError, type Schemas } from '@/lib/api/client';
import { usePoll, useReference, useSavePoll } from '@/lib/api/queries';
import { cn } from '@/lib/utils';

import { useAdmin } from './AdminShell';
import { closesAt, dateInput, lockedText, savedText, todayUtc, type PollStatus } from './data';
import { BUTTON, DANGER_GHOST, ICON_ONLY, INPUT, SMALL } from './ui';

type Option = { key: number; text: string; description: string };
type Question = { key: number; text: string; options: Option[] };
type Field = 'title' | 'description' | 'category' | 'closesAt' | 'status';
type Errors = Partial<Record<Field | 'questions', string>>;

let lastKey = 0;
const key = () => ++lastKey;

const option = (o?: { text: string; description: string }): Option => ({ key: key(), text: o?.text ?? '', description: o?.description ?? '' });
const question = (q?: Schemas['QuestionOut']): Question => ({
  key: key(),
  text: q?.text ?? '',
  options: q ? q.options.map(option) : [option(), option()],
});

const STATUSES: { value: PollStatus; label: string }[] = [
  { value: 'draft', label: 'Draft (hidden)' },
  { value: 'active', label: 'Live (open)' },
  { value: 'closed', label: 'Closed' },
];

/** The first question or option without text, and the message for it (admin.html's validateQuestions()) */
export function blankQuestion(questions: Question[]): { key: number; message: string } | null {
  for (const [i, q] of questions.entries()) {
    if (!q.text.trim()) return { key: q.key, message: `Question ${i + 1} needs its text.` };
    for (const [j, o] of q.options.entries())
      if (!o.text.trim()) return { key: o.key, message: `Question ${i + 1}, option ${j + 1} needs its text (or remove it).` };
  }
  return null;
}

function Shell({ heading, headingRef, children }: { heading: string; headingRef?: Ref<HTMLHeadingElement>; children?: ReactNode }) {
  return (
    <section aria-labelledby="editor-heading" className={CARD}>
      <Link href="/admin/polls" className="mb-[18px] inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-navy">
        <IconArrowLeft aria-hidden="true" size={15} /> Back to polls
      </Link>
      <h2 ref={headingRef} id="editor-heading" tabIndex={-1} className="mt-2.5 mb-[18px] font-serif text-[22px] font-semibold text-navy focus:outline-none">
        {heading}
      </h2>
      {children}
    </section>
  );
}

/** /admin/polls/[id]/edit: the poll with its questions, then the editor */
export function EditPoll({ id }: { id: number }) {
  const poll = usePoll(id);
  const { sessionEnds } = useAdmin();
  useEffect(() => {
    if (poll.error) sessionEnds(poll.error);
  }, [poll.error, sessionEnds]);
  if (poll.data) return <PollEditor poll={poll.data} />;
  return <Shell heading="Edit poll">{poll.isError ? <FormAlert text={poll.error.message} /> : null}</Shell>;
}

export function PollEditor({ poll }: { poll?: Schemas['PollOut'] }) {
  const router = useRouter();
  const { setFlash, sessionEnds } = useAdmin();
  const reference = useReference();
  const save = useSavePoll();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({
    title: poll?.title ?? '',
    description: poll?.description ?? '',
    category: poll?.category ?? '',
    closesAt: dateInput(poll?.closesAt ?? null),
    status: poll?.status ?? ('draft' as PollStatus),
  });
  const [questions, setQuestions] = useState<Question[]>(() => (poll ? poll.questions.map(question) : [question()]));
  const [errors, setErrors] = useState<Errors>({});
  const [badKey, setBadKey] = useState<number | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  // An input to focus once it's on screen: a new question or option, or a neighbour of a removed one
  const focusKey = useRef<number | null>(null);
  const [focusFirstError, setFocusFirstError] = useState(0);

  // Drafts can only be chosen while nobody has answered; answered questions can't change
  const locked = Boolean(poll?.responseCount);

  useEffect(() => headingRef.current?.focus(), []);
  useEffect(() => {
    if (focusKey.current === null) return;
    formRef.current?.querySelector<HTMLElement>(`[data-key="${focusKey.current}"]`)?.focus();
    focusKey.current = null;
  }, [questions]);
  useEffect(() => {
    if (focusFirstError) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusFirstError]);

  const set = (name: Field, value: string) => setValues((v) => ({ ...v, [name]: value }));
  const updateQuestion = (qKey: number, change: (q: Question) => Question) => setQuestions((qs) => qs.map((q) => (q.key === qKey ? change(q) : q)));

  function addOption(q: Question) {
    const added = option();
    updateQuestion(q.key, (x) => ({ ...x, options: [...x.options, added] }));
    focusKey.current = added.key;
  }
  function removeOption(q: Question, o: Option) {
    const i = q.options.indexOf(o);
    const next = q.options[i - 1] ?? q.options[i + 1];
    updateQuestion(q.key, (x) => ({ ...x, options: x.options.filter((y) => y !== o) }));
    if (next) focusKey.current = next.key;
  }
  function addQuestion() {
    const added = question();
    setQuestions((qs) => [...qs, added]);
    focusKey.current = added.key;
  }
  function removeQuestion(q: Question) {
    const i = questions.indexOf(q);
    const next = questions[i - 1] ?? questions[i + 1];
    setQuestions((qs) => qs.filter((x) => x !== q));
    if (next) focusKey.current = next.key;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAlert(null);
    const next: Errors = {};
    if (values.title.trim().length < 3) next.title = 'Give the poll a title of at least 3 characters.';
    if (!values.category) next.category = 'Choose a category.';
    if (values.closesAt && values.closesAt < todayUtc() && values.status === 'active') next.closesAt = 'A live poll needs a closing date of today or later.';
    const blank = locked ? null : blankQuestion(questions);
    if (blank) next.questions = blank.message;
    setErrors(next);
    setBadKey(blank?.key ?? null);
    const bad = Object.keys(next).length;
    if (bad) {
      setAlert(`Please fix the highlighted ${bad === 1 ? 'field' : 'fields'}.`);
      setFocusFirstError((n) => n + 1);
      return;
    }

    const body: Schemas['PollCreate'] = {
      title: values.title.trim(),
      description: values.description.trim(),
      category: values.category,
      status: values.status,
      closesAt: closesAt(values.closesAt),
      questions: questions.map((q) => ({
        text: q.text.trim(),
        options: q.options.map((o) => ({ text: o.text.trim(), description: o.description.trim() })),
      })),
    };
    const { questions: sent, ...fields } = body;
    save
      .mutateAsync({ id: poll?.id, body: locked ? fields : { ...fields, questions: sent } })
      .then((saved) => {
        setFlash({ text: savedText(saved, !poll), success: true });
        router.push('/admin/polls');
      })
      .catch((err: unknown) => {
        if (sessionEnds(err)) return;
        if (!(err instanceof ApiError)) throw err;
        setAlert(err.message);
        const fieldErrors: Errors = {};
        for (const name of ['title', 'category', 'closesAt', 'status', 'description'] as const) if (err.fields[name]) fieldErrors[name] = err.fields[name];
        setErrors(fieldErrors);
      });
  }

  const status = (name: Field) => (errors[name] ? 'error' : undefined);
  const categories: SelectOption[] | null | undefined = reference.isError ? null : reference.data?.categories.map((c) => ({ value: c.key, label: c.name }));

  return (
    <Shell heading={poll ? 'Edit poll' : 'New poll'} headingRef={headingRef}>
      {alert ? <FormAlert text={alert} /> : null}
      <form ref={formRef} noValidate onSubmit={onSubmit} aria-label={poll ? 'Edit poll' : 'New poll'} className="flex max-w-[860px] flex-col gap-4">
        <TextField
          id="ed-title"
          label="Title"
          Icon={IconHeading}
          value={values.title}
          onChange={(v) => set('title', v)}
          onBlur={() => {}}
          status={status('title')}
          error={errors.title}
          autoComplete="off"
          maxLength={200}
          hint={'Shown on cards and results. "Topic — detail" reads well, e.g. "Cost of living — household impact survey".'}
        />

        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="ed-description" className={LABEL}>
            Description
          </label>
          <textarea
            id="ed-description"
            rows={3}
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
            aria-invalid={Boolean(errors.description)}
            aria-describedby="ed-description-error"
            className="w-full resize-y rounded-md border border-navy/14 bg-cream px-3 py-2.5 text-[14px] leading-[normal] text-navy focus:border-gold focus:bg-white focus:outline-none aria-invalid:border-red"
          />
          <FieldError id="ed-description-error" error={errors.description} />
        </div>

        <div className="grid grid-cols-3 gap-3.5 tablet:grid-cols-1">
          <SelectField
            id="ed-category"
            label="Category"
            placeholder="Select…"
            options={categories}
            value={values.category}
            onChange={(v) => set('category', v)}
            status={status('category')}
            error={errors.category}
          />
          <TextField
            id="ed-closes"
            label={
              <>
                Closes on <span className="tracking-normal normal-case text-muted">(optional)</span>
              </>
            }
            Icon={IconCalendar}
            type="date"
            required={false}
            value={values.closesAt}
            onChange={(v) => set('closesAt', v)}
            onBlur={() => {}}
            status={status('closesAt')}
            error={errors.closesAt}
            autoComplete="off"
            hint="Closes at the end of this day (UTC)."
          />
          <SelectField
            id="ed-status"
            label="Status"
            options={STATUSES.map((s) => ({ ...s, disabled: s.value === 'draft' && locked && poll?.status !== 'draft' }))}
            value={values.status}
            onChange={(v) => set('status', v)}
            status={status('status')}
            error={errors.status}
            hint="Drafts are only visible to admins."
          />
        </div>

        <fieldset disabled={locked} className={cn('m-0 min-w-0 rounded-lg border px-[18px] pt-4 pb-[18px]', errors.questions ? 'border-red/40' : 'border-navy/10')}>
          <legend className="px-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Questions</legend>
          {locked ? (
            <p className="mb-3 flex items-start gap-2 rounded-md bg-gold/8 px-3 py-[9px] text-[12px] text-gold-ink">
              <IconLock aria-hidden="true" size={14} className="mt-px shrink-0" />
              <span>{lockedText(poll!.responseCount)}</span>
            </p>
          ) : null}
          <div className={errors.questions ? 'mb-2.5' : undefined}>
            <FieldError id="questions-error" error={errors.questions} />
          </div>
          <ol className="mb-3.5 flex flex-col gap-3.5">
            {questions.map((q, i) => {
              const id = `q-${q.key}`;
              return (
                <li key={q.key} className={cn('rounded-[6px] bg-cream p-3.5', locked && 'opacity-65')}>
                  <div className="mb-2 flex items-center justify-between gap-2.5">
                    <label htmlFor={id} className="font-mono text-[10px] uppercase tracking-[0.1em] text-gold-ink">
                      Question {i + 1}
                    </label>
                    <button type="button" disabled={questions.length === 1} onClick={() => removeQuestion(q)} className={cn(BUTTON, SMALL, DANGER_GHOST)}>
                      Remove question
                    </button>
                  </div>
                  <input
                    id={id}
                    data-key={q.key}
                    type="text"
                    maxLength={500}
                    placeholder="Question, e.g. How do you rate…?"
                    value={q.text}
                    onChange={(e) => updateQuestion(q.key, (x) => ({ ...x, text: e.target.value }))}
                    aria-invalid={badKey === q.key}
                    aria-describedby={badKey === q.key ? 'questions-error' : undefined}
                    className={cn(INPUT, 'mb-2.5 w-full text-[14px]')}
                  />
                  <ul className="mb-2.5 flex flex-col gap-1.5">
                    {q.options.map((o) => (
                      <li key={o.key} className="grid grid-cols-[1fr_1.3fr_auto] gap-1.5 tablet:grid-cols-[1fr_auto]">
                        <label className="sr-only" htmlFor={`opt-${o.key}`}>
                          Option text
                        </label>
                        <input
                          id={`opt-${o.key}`}
                          data-key={o.key}
                          type="text"
                          maxLength={200}
                          placeholder="Option, e.g. Approve"
                          value={o.text}
                          onChange={(e) => updateQuestion(q.key, (x) => ({ ...x, options: x.options.map((y) => (y === o ? { ...y, text: e.target.value } : y)) }))}
                          aria-invalid={badKey === o.key}
                          aria-describedby={badKey === o.key ? 'questions-error' : undefined}
                          className={INPUT}
                        />
                        <label className="sr-only" htmlFor={`opt-${o.key}-d`}>
                          Option description (optional)
                        </label>
                        <input
                          id={`opt-${o.key}-d`}
                          type="text"
                          maxLength={300}
                          placeholder="Description (optional)"
                          value={o.description}
                          onChange={(e) =>
                            updateQuestion(q.key, (x) => ({ ...x, options: x.options.map((y) => (y === o ? { ...y, description: e.target.value } : y)) }))
                          }
                          className={cn(INPUT, 'tablet:col-start-1 tablet:row-start-2')}
                        />
                        <button
                          type="button"
                          aria-label="Remove this option"
                          disabled={q.options.length <= 2}
                          onClick={() => removeOption(q, o)}
                          className={cn(BUTTON, SMALL, ICON_ONLY, 'tablet:col-start-2 tablet:row-start-1')}
                        >
                          <IconX aria-hidden="true" size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => addOption(q)} className={cn(BUTTON, SMALL)}>
                    <IconPlus aria-hidden="true" size={14} /> Add option
                  </button>
                </li>
              );
            })}
          </ol>
          {locked ? null : (
            <button type="button" onClick={addQuestion} className={BUTTON}>
              <IconPlus aria-hidden="true" size={15} /> Add question
            </button>
          )}
        </fieldset>

        <div className="flex items-center gap-2.5 [&>button:first-child]:mt-0">
          <SettingsButton label={save.isPending ? 'Saving…' : 'Save poll'} busy={save.isPending} />
          <button type="button" onClick={() => router.push('/admin/polls')} className={BUTTON}>
            Cancel
          </button>
        </div>
      </form>
    </Shell>
  );
}
