'use client';
import { useState } from 'react';
import {
  DELIVERY_PRESETS,
  timezoneLabel,
  validDeliveryTime,
} from '../../../packages/three-and-out/schedule';
import styles from './three-out-delivery-preferences.module.css';
export default function DeliveryTiming({
  time,
  timezone,
  disabled,
  onChange,
}: {
  time: string;
  timezone: string;
  disabled: boolean;
  onChange: (time: string) => void;
}) {
  const [custom, setCustom] = useState(false);
  const isCustom = custom || !DELIVERY_PRESETS.some((p) => p.time === time);
  return (
    <fieldset className={styles.timing} disabled={disabled}>
      <legend>When should we send it?</legend>
      <div className={styles.timingOptions}>
        {DELIVERY_PRESETS.map((p) => (
          <button
            type="button"
            key={p.id}
            aria-pressed={p.id === 'custom' ? isCustom : !isCustom && time === p.time}
            onClick={() => {
              setCustom(p.id === 'custom');
              if (p.time) onChange(p.time);
            }}
          >
            <strong>{p.label}</strong>
            <span>{p.detail}</span>
          </button>
        ))}
      </div>
      {isCustom ? (
        <label className={styles.customTime}>
          Delivery time
          <input
            type="time"
            value={time}
            onChange={(e) => {
              if (validDeliveryTime(e.target.value)) onChange(e.target.value);
            }}
          />
        </label>
      ) : null}
      <p className={styles.timezone}>Times shown in {timezoneLabel(timezone)}</p>
    </fieldset>
  );
}
