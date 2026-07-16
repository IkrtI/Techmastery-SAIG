import { useToastStore } from '@/stores/toastStore';

/** Success pill toast — green dot, auto-dismisses (see toastStore). */
export function ToastHost() {
  const message = useToastStore((s) => s.message);
  if (!message) return null;
  return (
    <div className="mm-toast" role="status" aria-live="polite">
      <span className="mm-toast__dot" />
      <span className="mm-toast__msg">{message}</span>
    </div>
  );
}
