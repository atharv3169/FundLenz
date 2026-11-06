'use client';
import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { blank, type Model } from '@/lib/atlas/model';
import type { Security } from '@/lib/securities';
import { useAtlas } from './context';
import { Dialog } from './ui';

export function CreateModelDialog({
  stock,
  onClose,
}: {
  stock?: Security | null;
  onClose: () => void;
}) {
  const { edit, setPeriod, go, notify } = useAtlas();
  const [name, setName] = useState(stock?.name.slice(0, 100) ?? '');
  const [currency, setCurrency] = useState<Model['currency']>('USD');
  const [sector, setSector] = useState<Model['sector']>('Operating company');
  return (
    <Dialog
      title={stock ? 'Start from this listing' : 'Start a blank company model'}
      onClose={onClose}
    >
      <p>
        {stock
          ? [stock.symbol, stock.exchange, 'identity dated ' + stock.asOf].join(
              ' · ',
            ) + '. '
          : 'Enter the company name and the currency used in its accounts. '}
        You’ll enter the financial assumptions next.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const model = blank(name.trim(), stock?.symbol || '');
          model.currency = currency;
          model.sector = sector;
          if (stock)
            model.source =
              'Identity only: ' +
              stock.id +
              ' · ' +
              stock.sourceIds.join(', ') +
              ' · ' +
              stock.asOf;
          edit(model, 'Started manual model');
          setPeriod(0);
          onClose();
          go('Assumptions');
          notify('New model opened. Undo returns to your previous worksheet.');
        }}
      >
        <label className="a-full">
          Company name
          <input
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="a-gridform">
          <label>
            Currency
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Model['currency'])}
            >
              {['USD', 'EUR', 'INR', 'GBP'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Business type
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value as Model['sector'])}
            >
              {['Operating company', 'Bank / insurer', 'REIT'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" className="a-primary" disabled={!name.trim()}>
          Create model <ArrowUpRight size={14} />
        </button>
      </form>
    </Dialog>
  );
}
