'use client';

import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useResetSettings, useUpdateSettings } from '@/hooks/useSettings';
import type { UpdateSettingsInput } from '@/lib/validations/settings';
import type { AppSettings } from '@/types';
import { useEffect, useMemo, useState } from 'react';
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
}

type DraftChange = SettingsEdit & { revision: number };

type EditorState = {
  server: AppSettings;
  changes: DraftChange[];
  revision: number;
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
}: SettingsFormProps) {
  const [editor, setEditor] = useState<EditorState>(() => ({
    server: settings,
    changes: [],
    revision: 0,
    pendingRevision: null,
  }));
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
    setEditor(previous => {
      const { field, value } = edit;
      const revision = previous.revision + 1;
      const otherChanges = previous.changes.filter(
        change => change.field !== field
      );
      const equalsServer = sameValue({
        left: value,
        right: previous.server[field],
      });
      return {
        ...previous,
        revision,
        // During a request, a revert to the old server value is still a new edit.
        changes:
          equalsServer && previous.pendingRevision === null
            ? otherChanges
            : [...otherChanges, { ...edit, revision }],
      };
    });
  };

  const handleSave = async () => {
    const submittedRevision = editor.revision;
    const changes: UpdateSettingsInput = Object.fromEntries(
      unsavedChanges.map(({ field, value }) => [field, value])
    );
    setSaveError(null);
    setEditor(previous => ({
      ...previous,
      pendingRevision: submittedRevision,
    }));
    try {
      const saved = await updateSettings.mutateAsync(changes);
      setEditor(previous => ({
        ...previous,
        server: saved,
        changes: pendingChanges({
          current: previous.changes,
          submittedRevision,
        }),
        pendingRevision: null,
      }));
      onSettingsUpdate();
    } catch (error) {
      setEditor(previous => ({ ...previous, pendingRevision: null }));
      setSaveError(
        error instanceof Error ? error.message : 'Failed to save settings'
      );
    }
  };

  const handleReset = () => {
    setSaveError(null);
    showConfirm({
      title: 'Reset Settings',
      message:
        'Are you sure you want to reset all settings to default values? This action cannot be undone.',
      confirmText: 'Reset',
      confirmColor: 'danger',
      onConfirm: async () => {
        const submittedRevision = editor.revision;
        setEditor(previous => ({
          ...previous,
          pendingRevision: submittedRevision,
        }));
        try {
          const defaults = await resetSettings.mutateAsync();
          setEditor(previous => ({
            ...previous,
            server: defaults,
            changes: pendingChanges({
              current: previous.changes,
              submittedRevision,
            }),
            pendingRevision: null,
          }));
          onSettingsUpdate();
        } catch (error) {
          setEditor(previous => ({ ...previous, pendingRevision: null }));
          throw error;
        }
      },
    });
  };

  const handleDiscard = () => {
    setSaveError(null);
    setEditor(previous => ({ ...previous, changes: [] }));
  };

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
