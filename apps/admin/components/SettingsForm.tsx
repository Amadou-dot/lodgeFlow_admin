'use client';

import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useResetSettings, useUpdateSettings } from '@/hooks/useSettings';
import type { UpdateSettingsInput } from '@/lib/validations/settings';
import type { AppSettings } from '@/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SettingsActionsSection,
  SettingsAmenitiesSection,
  SettingsBookingSection,
  SettingsCheckInOutSection,
  SettingsPricingSection,
} from './SettingsForm/index';
import type { SettingsEdit } from './SettingsForm/types';

interface SettingsFormProps {
  settings: AppSettings;
  onSettingsUpdate: () => void;
  unavailable?: boolean;
}

type DraftChange = SettingsEdit & { revision: number };

type EditorState = {
  server: AppSettings;
  changes: DraftChange[];
  pendingRevision: number | null;
};

// Settings is a JSON DTO. Compare nested values, including notifications and
// business hours, by value instead of treating a refreshed object as an edit.
function sameValue({
  left,
  right,
}: {
  left: unknown;
  right: unknown;
}): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) =>
        sameValue({ left: value, right: right[index] })
      )
    );
  }
  if (
    !left ||
    !right ||
    typeof left !== 'object' ||
    typeof right !== 'object'
  ) {
    return false;
  }
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  if (leftEntries.length !== rightEntries.length) return false;
  const rightValues = new Map(rightEntries);
  return leftEntries.every(
    ([key, value]) =>
      rightValues.has(key) &&
      sameValue({ left: value, right: rightValues.get(key) })
  );
}

function pendingChanges({
  current,
  submittedRevision,
}: {
  current: DraftChange[];
  submittedRevision: number;
}) {
  return current.filter(change => change.revision > submittedRevision);
}

export default function SettingsForm({
  settings,
  onSettingsUpdate,
  unavailable = false,
}: SettingsFormProps) {
  const [editor, setEditor] = useState<EditorState>(() => ({
    server: settings,
    changes: [],

    pendingRevision: null,
  }));
  const revision = useRef(0);
  const writing = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const updateSettings = useUpdateSettings();
  const resetSettings = useResetSettings();
  const { showConfirm, ConfirmDialog } = useConfirmDialog();

  useEffect(() => {
    setEditor(previous => ({
      ...previous,
      server: settings,
      changes: previous.changes.filter(
        change =>
          (previous.pendingRevision !== null &&
            change.revision > previous.pendingRevision) ||
          !sameValue({ left: change.value, right: settings[change.field] })
      ),
    }));
  }, [settings]);

  const formData = useMemo<Partial<AppSettings>>(
    () => ({
      ...editor.server,
      ...Object.fromEntries(
        editor.changes.map(({ field, value }) => [field, value])
      ),
    }),
    [editor]
  );
  const unsavedChanges = editor.changes.filter(
    change =>
      !sameValue({ left: change.value, right: editor.server[change.field] })
  );

  const handleInputChange = (edit: SettingsEdit) => {
    setSaveError(null);
    const editRevision = ++revision.current;
    setEditor(previous => {
      const { field, value } = edit;
      const otherChanges = previous.changes.filter(
        change => change.field !== field
      );
      const equalsServer = sameValue({
        left: value,
        right: previous.server[field],
      });
      return {
        ...previous,
        // During a request, a revert to the old server value is still a new edit.
        changes:
          equalsServer && previous.pendingRevision === null
            ? otherChanges
            : [...otherChanges, { ...edit, revision: editRevision }],
      };
    });
  };

  const writeSettings = async (
    operation:
      { kind: 'save'; changes: UpdateSettingsInput } | { kind: 'reset' }
  ) => {
    // A captured confirmation and a second click can both precede React's next render.
    if (writing.current) return;
    writing.current = true;
    const submittedRevision = revision.current;
    setSaveError(null);
    setEditor(previous => ({
      ...previous,
      pendingRevision: submittedRevision,
    }));
    try {
      const server =
        operation.kind === 'save'
          ? await updateSettings.mutateAsync(operation.changes)
          : await resetSettings.mutateAsync();
      setEditor(previous => ({
        ...previous,
        server,
        changes: pendingChanges({
          current: previous.changes,
          submittedRevision,
        }),
        pendingRevision: null,
      }));
      onSettingsUpdate();
    } catch (error) {
      setEditor(previous => ({ ...previous, pendingRevision: null }));
      if (operation.kind === 'reset') throw error;
      setSaveError(
        error instanceof Error ? error.message : 'Failed to save settings'
      );
    } finally {
      writing.current = false;
    }
  };

  const handleSave = () =>
    writeSettings({
      kind: 'save',
      changes: Object.fromEntries(
        unsavedChanges.map(({ field, value }) => [field, value])
      ),
    });
  const handleReset = () => {
    if (writing.current) return;
    setSaveError(null);
    showConfirm({
      title: 'Reset Settings',
      message:
        'Are you sure you want to reset all settings to default values? This action cannot be undone.',
      confirmText: 'Reset',
      confirmColor: 'danger',
      onConfirm: () => writeSettings({ kind: 'reset' }),
    });
  };

  const handleDiscard = () => {
    setSaveError(null);
    setEditor(previous => ({ ...previous, changes: [] }));
  };

  if (unavailable) return null;

  return (
    <div className='space-y-6'>
      <SettingsBookingSection
        formData={formData}
        onInputChange={handleInputChange}
      />

      <SettingsCheckInOutSection
        formData={formData}
        onInputChange={handleInputChange}
      />

      <SettingsPricingSection
        formData={formData}
        onInputChange={handleInputChange}
      />

      <SettingsAmenitiesSection
        formData={formData}
        onInputChange={handleInputChange}
      />

      <SettingsActionsSection
        hasChanges={unsavedChanges.length > 0}
        isWriting={editor.pendingRevision !== null}
        onSave={handleSave}
        onDiscard={handleDiscard}
        onReset={handleReset}
        isSaving={updateSettings.isPending}
        isResetting={resetSettings.isPending}
      />

      {saveError && (
        <p role='alert' className='text-danger'>
          {saveError}
        </p>
      )}

      <ConfirmDialog />
    </div>
  );
}
