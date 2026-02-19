'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Link from 'next/link';

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
  enable_entry_gate_flow?: boolean;
}

interface ScannerEventOption {
  id: string;
  title: string;
}

interface EntryGate {
  id: string;
  name: string;
  code?: string | null;
  sort_order: number;
  is_active: boolean;
}

interface ScanResult {
  success: boolean;
  message: string;
  ticket?: TicketData;
  order?: OrderData;
  event?: EventData;
  allTickets?: TicketData[];
  entryGateFlowEnabled?: boolean;
  gateScanProgress?: {
    completedCount: number;
    totalCount: number;
    completedGateIds: string[];
  };
  gateScans?: {
    gateId: string;
    gateName: string;
    scannedAt: string;
    scannedBy: string | null;
  }[];
  currentGateResult?: 'scanned' | 'already_scanned' | 'not_applicable';
  error?: string;
}

export default function ScanPage() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualQrData, setManualQrData] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [events, setEvents] = useState<ScannerEventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [gates, setGates] = useState<EntryGate[]>([]);
  const [selectedGateId, setSelectedGateId] = useState<string>('');
  const [loadingGates, setLoadingGates] = useState(false);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const scanBusyRef = useRef(false);
  const lastScanRef = useRef(0);
  const canStartScanning = Boolean(selectedEventId && selectedGateId);

  const loadScannerEvents = async () => {
    const response = await fetch('/api/events', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to load events');
    }
    const payload = await response.json();
    const options: ScannerEventOption[] = (payload.events ?? []).map((event: any) => ({
      id: event.id,
      title: event.title,
    }));
    setEvents(options);

    if (!selectedEventId && options.length > 0) {
      setSelectedEventId(options[0].id);
    }
  };

  const loadEventGates = async (eventId: string) => {
    if (!eventId) {
      setGates([]);
      setSelectedGateId('');
      return;
    }

    setLoadingGates(true);
    try {
      const response = await fetch(`/api/events/${eventId}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load event gates');
      }
      const payload = await response.json();
      const event = payload.event as EventData | undefined;
      const allGates: EntryGate[] = ((payload.entry_gates ?? []) as EntryGate[])
        .filter((gate) => gate.is_active)
        .sort((a, b) => a.sort_order - b.sort_order);

      if (event?.enable_entry_gate_flow) {
        setGates(allGates);
        if (allGates.length === 0) {
          setSelectedGateId('');
          setError('Entry gate flow is enabled but no active gates are configured for this event.');
          return;
        }
        setSelectedGateId((current) =>
          allGates.some((gate) => gate.id === current) ? current : allGates[0].id,
        );
      } else {
        setGates([{ id: '__default_gate__', name: 'General Entry', sort_order: 0, is_active: true }]);
        setSelectedGateId('__default_gate__');
      }
    } catch (gateError: any) {
      setError(gateError?.message ?? 'Failed to load gate configuration.');
      setGates([]);
      setSelectedGateId('');
    } finally {
      setLoadingGates(false);
    }
  };

  const startScanning = async () => {
    try {
      if (!canStartScanning) {
        setError('Select event and gate to start scanning.');
        return;
      }
      setError(null);
      setCameraError(null);
      setResult(null);
      
      const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isSecure) {
        throw new Error('Camera access requires HTTPS.');
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available.');
      }

      setScanning(true);

      // Wait for render
      await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((resolve) => {
          const v = videoRef.current!;
          if (v.readyState >= 2) resolve();
          else v.addEventListener('canplay', () => resolve(), { once: true });
          v.play().catch(() => {});
        });
      }

      const scanner = new Html5Qrcode('qr-hidden');
      scannerRef.current = scanner;

      if (!canvasRef.current || !videoRef.current) return;

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!context) return;

      const scanLoop = () => {
        if (!videoRef.current || !scannerRef.current || !canvas || !context) {
          rafIdRef.current = requestAnimationFrame(scanLoop);
          return;
        }

        const now = performance.now();
        // Throttle scanning to every 300ms
        if (scanBusyRef.current || now - lastScanRef.current < 300) {
          rafIdRef.current = requestAnimationFrame(scanLoop);
          return;
        }

        lastScanRef.current = now;
        scanBusyRef.current = true;

        try {
            // Draw current frame
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
          context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            
          canvas.toBlob((blob) => {
            if (!blob || !scannerRef.current) {
              scanBusyRef.current = false;
              rafIdRef.current = requestAnimationFrame(scanLoop);
              return;
            }

            const file = new File([blob], 'frame.png', { type: 'image/png' });
                scannerRef.current.scanFile(file, false)
              .then((decodedText) => {
                handleScanSuccess(decodedText);
              })
                    .catch(() => {
                         // No QR code found, continue scanning
                scanBusyRef.current = false;
                  rafIdRef.current = requestAnimationFrame(scanLoop);
              });
          }, 'image/png');

        } catch (e) {
          scanBusyRef.current = false;
          rafIdRef.current = requestAnimationFrame(scanLoop);
        }
      };

      rafIdRef.current = requestAnimationFrame(scanLoop);
    } catch (err: any) {
      console.error('Camera error:', err);
      setCameraError(err.message || 'Failed to access camera');
      setScanning(false);
      cleanupCamera();
    }
  };

  const cleanupCamera = () => {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (scannerRef.current) {
      try { scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const stopScanning = async () => {
    cleanupCamera();
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrData,
          eventId: selectedEventId,
          gateId: selectedGateId === '__default_gate__' ? undefined : selectedGateId,
        }),
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
      setError(err.message || 'Network error. Please check your connection.');
    }
  };

  const handleManualSubmit = () => {
    if (!canStartScanning) {
      setError('Select event and gate to start scanning.');
      return;
    }
    if (!manualQrData.trim()) {
      setError('Please enter QR code data');
      return;
    }
    verifyTicket(manualQrData.trim());
    setManualEntry(false);
  };

  const resetScan = () => {
    setResult(null);
    setError(null);
    setManualEntry(false);
    setManualQrData('');
    setIsRejecting(false);
  };

  const handleRejectTicket = async () => {
    if (!result?.ticket?.id) return;

    try {
      setIsRejecting(true);

      const response = await fetch('/api/tickets/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: result.ticket.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || data.error || 'Failed to reject ticket');
        return;
      }

      setResult({
        success: false,
        message: 'Ticket rejected and removed from inventory',
        ticket: result.ticket,
        order: result.order,
        event: result.event,
        allTickets: result.allTickets,
      });
    } catch (err: any) {
      setError(err.message || 'Network error. Please check your connection.');
    } finally {
      setIsRejecting(false);
    }
  };

  useEffect(() => {
    loadScannerEvents().catch((loadError: any) => {
      setError(loadError?.message ?? 'Failed to load events for scanner.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadEventGates(selectedEventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  useEffect(() => {
    return () => cleanupCamera();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--hh-text)] tracking-tight">Scan Tickets</h1>
          <p className="text-[var(--hh-text-secondary)] mt-1">Verify attendee tickets securely</p>
        </div>
        <Link href="/events" className="hh-btn-secondary flex items-center gap-2 text-sm">
           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
           </svg>
           Exit
        </Link>
      </div>

      <div className="hh-card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--hh-text-secondary)] mb-1">Event</label>
            <select
              className="hh-input w-full"
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
            >
              <option value="">Select event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--hh-text-secondary)] mb-1">Gate</label>
            <select
              className="hh-input w-full"
              value={selectedGateId}
              onChange={(event) => setSelectedGateId(event.target.value)}
              disabled={!selectedEventId || loadingGates || gates.length === 0}
            >
              <option value="">{loadingGates ? 'Loading gates...' : 'Select gate'}</option>
              {gates.map((gate) => (
                <option key={gate.id} value={gate.id}>
                  {gate.name}{gate.code ? ` (${gate.code})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <div className="rounded-xl border border-[var(--hh-border)] bg-[var(--hh-bg-elevated)] px-3 py-2 text-sm w-full">
              <div className="text-[var(--hh-text-secondary)] text-xs">Scanner context</div>
              <div className="text-[var(--hh-text)] font-semibold">
                {selectedEventId && selectedGateId
                  ? `${events.find((event) => event.id === selectedEventId)?.title ?? 'Event'} • ${gates.find((gate) => gate.id === selectedGateId)?.name ?? 'Gate'}`
                  : 'Select event and gate to start scanning'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Action Area */}
      {!result && !manualEntry && !scanning && (
        <div className="hh-card p-8 md:p-12 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px]">
          <div className="w-20 h-20 bg-[var(--hh-primary)]/10 rounded-full flex items-center justify-center text-[var(--hh-primary)] mb-2">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <div>
             <h3 className="text-xl font-semibold text-[var(--hh-text)] mb-2">Ready to Scan</h3>
             <p className="text-[var(--hh-text-secondary)] max-w-md mx-auto">
                Point your device camera at a ticket QR code to verify its validity instantly.
             </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
             <button
                onClick={startScanning}
                disabled={!canStartScanning}
                className="hh-btn-primary py-3 flex-1 flex items-center justify-center gap-2 text-base disabled:opacity-60 disabled:cursor-not-allowed"
             >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Open Camera
                </button>
             <button
                onClick={() => setManualEntry(true)}
                disabled={!canStartScanning}
                className="hh-btn-secondary py-3 flex-1 flex items-center justify-center gap-2 text-base disabled:opacity-60 disabled:cursor-not-allowed"
             >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Manual Entry
                </button>
              </div>
          {error && (
             <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
             </div>
          )}
        </div>
      )}

      {/* Scanner View */}
      {scanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="relative flex-1 overflow-hidden">
                  <video
                    ref={videoRef}
                autoPlay playsInline muted
                className="absolute inset-0 w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <div id="qr-hidden" className="hidden" />
             
             {/* Overlay */}
             <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-8">
                <div className="absolute top-6 left-6 rounded-full bg-black/65 border border-white/20 px-4 py-2 text-xs text-white backdrop-blur-md">
                  Event: {events.find((event) => event.id === selectedEventId)?.title ?? '—'} | Gate: {gates.find((gate) => gate.id === selectedGateId)?.name ?? '—'}
                </div>
                <div className="relative w-full max-w-xs aspect-square border-2 border-white/30 rounded-3xl overflow-hidden">
                    <div className="absolute inset-0 border-2 border-[var(--hh-primary)] rounded-3xl animate-pulse opacity-75"></div>
                    {/* Scanning line animation */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-[var(--hh-primary)] shadow-[0_0_15px_rgba(139,92,246,0.8)] animate-[scan_2s_infinite_linear]"></div>
                </div>
                <p className="text-white/80 mt-8 font-medium text-center bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
                    Align QR code within the frame
                </p>
             </div>

             {/* Close Button */}
             <button
                onClick={async () => {
                  await stopScanning();
                }}
                className="absolute top-6 right-24 px-4 py-2 bg-black/50 text-white rounded-full backdrop-blur-md hover:bg-black/70 transition-colors text-sm"
             >
                Switch Gate
             </button>
             <button onClick={stopScanning} className="absolute top-6 right-6 p-3 bg-black/50 text-white rounded-full backdrop-blur-md hover:bg-black/70 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                </button>
              </div>
              </div>
            )}

      {/* Manual Entry View */}
        {manualEntry && !result && (
        <div className="hh-card p-6 md:p-8 max-w-xl mx-auto">
           <h2 className="text-xl font-bold text-[var(--hh-text)] mb-6">Manual Verification</h2>
          <div className="space-y-4">
            <div>
                 <label className="block text-sm font-medium mb-2 text-[var(--hh-text-secondary)]">QR Code Data</label>
              <textarea
                value={manualQrData}
                onChange={(e) => setManualQrData(e.target.value)}
                    placeholder='Paste the raw QR code data here...'
                    className="hh-input w-full font-mono text-sm min-h-[150px]"
              />
            </div>
              <div className="flex gap-3 pt-2">
                 <button onClick={handleManualSubmit} className="hh-btn-primary flex-1 justify-center">Verify</button>
                 <button onClick={() => setManualEntry(false)} className="hh-btn-secondary flex-1 justify-center">Cancel</button>
            </div>
            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
              </div>
            )}
           </div>
          </div>
        )}

      {/* Result View */}
        {result && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Status Banner */}
            <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-center gap-6 text-center md:text-left ${
                result.success
                ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center shrink-0 ${
                     result.success ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}>
                    {result.success ? (
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    )}
                </div>
                 <div className="flex-1">
                     <h2 className="text-2xl font-bold mb-1">{result.success ? 'Ticket Valid' : 'Invalid Ticket'}</h2>
                     <p className={`opacity-90 ${result.success ? 'text-green-300' : 'text-red-300'}`}>{result.message}</p>
                 </div>
                 <div className="flex gap-3">
                     {result.success && result.ticket?.status === 'active' && (
                         <button
                             onClick={handleRejectTicket}
                             disabled={isRejecting}
                             className="px-6 py-3 rounded-xl font-semibold transition-transform active:scale-95 bg-red-500 text-white hover:bg-red-400 disabled:opacity-50"
                         >
                             {isRejecting ? 'Rejecting...' : 'Reject Ticket'}
                         </button>
                     )}
                     <button onClick={resetScan} className={`px-6 py-3 rounded-xl font-semibold transition-transform active:scale-95 ${
                          result.success
                          ? 'bg-green-500 text-green-950 hover:bg-green-400'
                          : 'bg-red-500 text-white hover:bg-red-400'
                     }`}>
                         Scan Next
                     </button>
                 </div>
            </div>

            {result.entryGateFlowEnabled && (
              <div className="hh-card p-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                  <h3 className="text-lg font-semibold text-[var(--hh-text)]">Entry Progress</h3>
                  <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-[var(--hh-primary)]/20 text-[var(--hh-text)] border border-[var(--hh-primary)]/40">
                    {result.gateScanProgress?.completedCount ?? 0} / {result.gateScanProgress?.totalCount ?? 0} gates
                  </span>
                </div>
                <p className="text-sm text-[var(--hh-text-secondary)] mb-2">
                  {result.currentGateResult === 'already_scanned'
                    ? 'Already scanned at this gate.'
                    : result.currentGateResult === 'scanned'
                      ? 'Gate scanned successfully.'
                      : 'Gate scan not applicable.'}
                </p>
                <div className="space-y-2">
                  {(result.gateScans ?? []).length === 0 ? (
                    <p className="text-sm text-[var(--hh-text-secondary)]">No gate scans recorded yet.</p>
                  ) : (
                    result.gateScans?.map((scan) => (
                      <div key={`${scan.gateId}-${scan.scannedAt}`} className="rounded-xl border border-[var(--hh-border)] bg-[var(--hh-bg-elevated)] px-3 py-2 text-sm">
                        <div className="font-medium text-[var(--hh-text)]">{scan.gateName}</div>
                        <div className="text-[var(--hh-text-secondary)]">
                          {formatDate(scan.scannedAt)}{scan.scannedBy ? ` • ${scan.scannedBy}` : ''}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {result.ticket && result.event && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Attendee Info */}
                    <div className="hh-card p-6">
                        <h3 className="text-lg font-semibold text-[var(--hh-text)] mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-[var(--hh-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Attendee
                        </h3>
                        <div className="space-y-4">
                    <div>
                                 <div className="text-sm text-[var(--hh-text-secondary)]">Name</div>
                                 <div className="text-xl font-medium text-[var(--hh-text)]">{result.ticket.attendee_name}</div>
                    </div>
                             <div className="flex gap-4">
                    <div>
                                     <div className="text-sm text-[var(--hh-text-secondary)]">Tier</div>
                                     <div className="text-[var(--hh-text)] font-medium">{result.ticket.tier?.name || 'Standard'}</div>
                    </div>
                    <div>
                                     <div className="text-sm text-[var(--hh-text-secondary)]">Status</div>
                                     <div className="capitalize font-medium">{result.ticket.status}</div>
                    </div>
                    </div>
                    <div>
                                 <div className="text-sm text-[var(--hh-text-secondary)]">Ticket ID</div>
                                 <div className="font-mono text-sm text-[var(--hh-text-tertiary)] bg-[var(--hh-bg-input)] px-2 py-1 rounded inline-block">
                                     {result.ticket.id}
                    </div>
                  </div>
                </div>
                    </div>

                    {/* Event Info */}
                    <div className="hh-card p-6">
                        <h3 className="text-lg font-semibold text-[var(--hh-text)] mb-4 flex items-center gap-2">
                             <svg className="w-5 h-5 text-[var(--hh-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Event Details
                        </h3>
                        <div className="space-y-3">
                      <div>
                                <div className="text-lg font-medium text-[var(--hh-text)]">{result.event.title}</div>
                                <div className="text-sm text-[var(--hh-text-secondary)]">{formatDate(result.event.start_at)}</div>
                            </div>
                            {result.event.venue_name && (
                                <div className="flex items-start gap-2 text-sm text-[var(--hh-text-secondary)]">
                                    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {result.event.venue_name}, {result.event.city}
                      </div>
                    )}
                        </div>
                  </div>
                      </div>
                    )}

            {/* Group Tickets in same order */}
            {result.allTickets && result.allTickets.length > 1 && (
                <div className="hh-card p-6">
                    <h3 className="text-lg font-semibold text-[var(--hh-text)] mb-4">Other Tickets in Order ({result.allTickets.length})</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {result.allTickets.filter(t => t.id !== result.ticket?.id).map(t => (
                            <div key={t.id} className="p-3 rounded-xl bg-[var(--hh-bg-elevated)] border border-[var(--hh-border)] flex items-center justify-between">
                    <div>
                                    <div className="font-medium text-[var(--hh-text)]">{t.attendee_name}</div>
                                    <div className="text-xs text-[var(--hh-text-secondary)]">{t.tier?.name}</div>
                    </div>
                                <span className={`text-xs px-2 py-1 rounded-full capitalize border ${
                                    t.status === 'used' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                                    t.status === 'valid' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                                    'bg-[var(--hh-bg-input)] text-[var(--hh-text-tertiary)] border-[var(--hh-border)]'
                                }`}>
                                    {t.status}
                            </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
      
      {/* CSS animation for scanner line */}
      <style jsx global>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
