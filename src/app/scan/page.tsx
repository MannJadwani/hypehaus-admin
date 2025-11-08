'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface TicketData {
  id: string;
  attendee_name: string;
  status: string;
  created_at: string;
  scanned_at?: string;
  tier: {
    id: string;
    name: string;
    price_cents: number;
  } | null;
}

interface OrderData {
  id: string;
  user_id: string;
  status: string;
  total_amount_cents: number;
  currency: string;
  email: string;
  whatsapp_number: string;
  attendee_names: string[];
  notes: any;
  created_at: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
}

interface EventData {
  id: string;
  title: string;
  description?: string;
  start_at: string;
  end_at?: string;
  venue_name?: string;
  address_line?: string;
  city?: string;
  hero_image_url?: string;
}

interface ScanResult {
  success: boolean;
  message: string;
  ticket?: TicketData;
  order?: OrderData;
  event?: EventData;
  allTickets?: TicketData[];
  error?: string;
}

export default function ScanPage() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualQrData, setManualQrData] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerElementRef = useRef<HTMLDivElement>(null);

  const startScanning = async () => {
    try {
      setError(null);
      setCameraError(null);
      setResult(null);
      setScanning(true);

      const scanner = new Html5Qrcode('scanner');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Ignore scanning errors (they're expected during scanning)
        }
      );
    } catch (err: any) {
      console.error('Camera error:', err);
      setCameraError(err.message || 'Failed to access camera');
      setScanning(false);
      if (err.message?.includes('Permission')) {
        setError('Camera permission denied. Please allow camera access and try again.');
      } else if (err.message?.includes('not found') || err.message?.includes('No cameras')) {
        setError('No camera found. Please use a device with a camera or enter QR code manually.');
      } else {
        setError('Failed to start camera. Please check your camera settings.');
      }
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (e) {
        console.error('Error stopping scanner:', e);
      }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handleScanSuccess = async (qrData: string) => {
    await stopScanning();
    await verifyTicket(qrData);
  };

  const verifyTicket = async (qrData: string) => {
    try {
      setError(null);
      setResult(null);

      const response = await fetch('/api/tickets/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ qrData }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({
          success: false,
          message: data.message || data.error || 'Failed to verify ticket',
          error: data.error,
          ticket: data.ticket,
          order: data.order,
          event: data.event,
          allTickets: data.allTickets,
        });
        return;
      }

      setResult({
        success: true,
        message: data.message || 'Ticket verified successfully',
        ticket: data.ticket,
        order: data.order,
        event: data.event,
        allTickets: data.allTickets,
      });
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.message || 'Network error. Please check your connection and try again.');
    }
  };

  const handleManualSubmit = () => {
    if (!manualQrData.trim()) {
      setError('Please enter QR code data');
      return;
    }
    verifyTicket(manualQrData.trim());
  };

  const resetScan = () => {
    setResult(null);
    setError(null);
    setManualEntry(false);
    setManualQrData('');
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (cents: number, currency: string = 'INR') => {
    const amount = cents / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-[var(--hh-bg)] p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6 text-[var(--hh-text)]">Scan Ticket</h1>

        {!result && !manualEntry && (
          <div className="space-y-4">
            {!scanning ? (
              <div className="space-y-4">
                <button
                  onClick={startScanning}
                  className="hh-btn-primary w-full py-3 text-lg"
                >
                  Start Scanning
                </button>
                <button
                  onClick={() => setManualEntry(true)}
                  className="hh-btn-secondary w-full py-3"
                >
                  Enter QR Code Manually
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  id="scanner"
                  ref={scannerElementRef}
                  className="w-full max-w-md mx-auto bg-black rounded-lg overflow-hidden"
                  style={{ minHeight: '400px' }}
                />
                <button
                  onClick={stopScanning}
                  className="hh-btn-secondary w-full py-3"
                >
                  Stop Scanning
                </button>
              </div>
            )}

            {cameraError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
                <p className="font-medium">Camera Error</p>
                <p className="text-sm mt-1">{cameraError}</p>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
                <p className="font-medium">Error</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}
          </div>
        )}

        {manualEntry && !result && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--hh-text-secondary)]">
                QR Code Data
              </label>
              <textarea
                value={manualQrData}
                onChange={(e) => setManualQrData(e.target.value)}
                placeholder='Paste QR code JSON data here (e.g., {"order_id":"...","ticket_index":0,...})'
                className="w-full px-4 py-3 bg-[var(--hh-bg-input)] border border-[var(--hh-border)] rounded-lg text-[var(--hh-text)] placeholder:text-[var(--hh-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--hh-primary)]"
                rows={6}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleManualSubmit}
                className="hh-btn-primary flex-1 py-3"
              >
                Verify Ticket
              </button>
              <button
                onClick={() => {
                  setManualEntry(false);
                  setManualQrData('');
                  setError(null);
                }}
                className="hh-btn-secondary px-6 py-3"
              >
                Cancel
              </button>
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
                <p className="font-medium">Error</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div
              className={`border rounded-lg p-6 ${
                result.success
                  ? 'bg-green-500/10 border-green-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2
                    className={`text-xl font-semibold ${
                      result.success ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {result.success ? '✓ Ticket Verified' : '✗ Verification Failed'}
                  </h2>
                  <p className="text-sm mt-1 text-[var(--hh-text-secondary)]">
                    {result.message}
                  </p>
                </div>
                <button
                  onClick={resetScan}
                  className="hh-btn-secondary px-4 py-2 text-sm"
                >
                  Scan Another
                </button>
              </div>
            </div>

            {result.ticket && result.order && result.event && (
              <div className="space-y-6">
                {/* Order Information */}
                <div className="hh-card p-6">
                  <h3 className="text-lg font-semibold mb-4 text-[var(--hh-text)]">Order Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[var(--hh-text-tertiary)]">Order ID:</span>
                      <p className="font-mono text-[var(--hh-text)]">{result.order.id.slice(0, 8)}...</p>
                    </div>
                    <div>
                      <span className="text-[var(--hh-text-tertiary)]">Status:</span>
                      <p className="text-[var(--hh-text)] capitalize">{result.order.status}</p>
                    </div>
                    <div>
                      <span className="text-[var(--hh-text-tertiary)]">Total Amount:</span>
                      <p className="text-[var(--hh-text)]">
                        {formatCurrency(result.order.total_amount_cents, result.order.currency)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[var(--hh-text-tertiary)]">Payment Method:</span>
                      <p className="text-[var(--hh-text)]">
                        {result.order.notes?.payment_method || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[var(--hh-text-tertiary)]">Order Date:</span>
                      <p className="text-[var(--hh-text)]">{formatDate(result.order.created_at)}</p>
                    </div>
                    {result.order.razorpay_order_id && (
                      <div>
                        <span className="text-[var(--hh-text-tertiary)]">Razorpay Order:</span>
                        <p className="font-mono text-xs text-[var(--hh-text)]">
                          {result.order.razorpay_order_id}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Account Information */}
                <div className="hh-card p-6">
                  <h3 className="text-lg font-semibold mb-4 text-[var(--hh-text)]">Account Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[var(--hh-text-tertiary)]">Email:</span>
                      <p className="text-[var(--hh-text)]">{result.order.email}</p>
                    </div>
                    <div>
                      <span className="text-[var(--hh-text-tertiary)]">WhatsApp:</span>
                      <p className="text-[var(--hh-text)]">{result.order.whatsapp_number}</p>
                    </div>
                    <div>
                      <span className="text-[var(--hh-text-tertiary)]">User ID:</span>
                      <p className="font-mono text-xs text-[var(--hh-text)]">
                        {result.order.user_id.slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                </div>

                {/* Event Information */}
                <div className="hh-card p-6">
                  <h3 className="text-lg font-semibold mb-4 text-[var(--hh-text)]">Event Information</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-[var(--hh-text-tertiary)]">Event:</span>
                      <p className="text-lg font-semibold text-[var(--hh-text)]">{result.event.title}</p>
                    </div>
                    {result.event.description && (
                      <div>
                        <span className="text-[var(--hh-text-tertiary)]">Description:</span>
                        <p className="text-[var(--hh-text)]">{result.event.description}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[var(--hh-text-tertiary)]">Start:</span>
                        <p className="text-[var(--hh-text)]">{formatDate(result.event.start_at)}</p>
                      </div>
                      {result.event.end_at && (
                        <div>
                          <span className="text-[var(--hh-text-tertiary)]">End:</span>
                          <p className="text-[var(--hh-text)]">{formatDate(result.event.end_at)}</p>
                        </div>
                      )}
                    </div>
                    {(result.event.venue_name || result.event.city) && (
                      <div>
                        <span className="text-[var(--hh-text-tertiary)]">Venue:</span>
                        <p className="text-[var(--hh-text)]">
                          {[result.event.venue_name, result.event.address_line, result.event.city]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scanned Ticket */}
                <div className="hh-card p-6">
                  <h3 className="text-lg font-semibold mb-4 text-[var(--hh-text)]">Scanned Ticket</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-[var(--hh-text-tertiary)]">Attendee:</span>
                      <p className="text-lg font-semibold text-[var(--hh-text)]">
                        {result.ticket.attendee_name}
                      </p>
                    </div>
                    {result.ticket.tier && (
                      <div>
                        <span className="text-[var(--hh-text-tertiary)]">Tier:</span>
                        <p className="text-[var(--hh-text)]">{result.ticket.tier.name}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-[var(--hh-text-tertiary)]">Status:</span>
                      <p
                        className={`font-semibold capitalize ${
                          result.ticket.status === 'used'
                            ? 'text-green-400'
                            : result.ticket.status === 'cancelled'
                            ? 'text-red-400'
                            : 'text-[var(--hh-text)]'
                        }`}
                      >
                        {result.ticket.status}
                      </p>
                    </div>
                    {result.ticket.scanned_at && (
                      <div>
                        <span className="text-[var(--hh-text-tertiary)]">Scanned At:</span>
                        <p className="text-[var(--hh-text)]">{formatDate(result.ticket.scanned_at)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* All Tickets in Order */}
                {result.allTickets && result.allTickets.length > 0 && (
                  <div className="hh-card p-6">
                    <h3 className="text-lg font-semibold mb-4 text-[var(--hh-text)]">
                      All Tickets in Order ({result.allTickets.length})
                    </h3>
                    <div className="space-y-3">
                      {result.allTickets.map((ticket, index) => (
                        <div
                          key={ticket.id}
                          className="border border-[var(--hh-border)] rounded-lg p-4 bg-[var(--hh-bg-elevated)]"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-[var(--hh-text)]">
                                {ticket.attendee_name}
                              </p>
                              {ticket.tier && (
                                <p className="text-sm text-[var(--hh-text-secondary)] mt-1">
                                  {ticket.tier.name}
                                </p>
                              )}
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                                ticket.status === 'used'
                                  ? 'bg-green-500/20 text-green-400'
                                  : ticket.status === 'cancelled'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-blue-500/20 text-blue-400'
                              }`}
                            >
                              {ticket.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

