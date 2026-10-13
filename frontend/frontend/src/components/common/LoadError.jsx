// Friendly "couldn't load" panel that says WHY, instead of a generic message.
export default function LoadError({ status, what = "this page", onRetry }) {
  let hint;
  if (status === 401 || status === 403) hint = "Your session may have expired. Please log in again.";
  else if (!status) hint = "Can't reach the server. Check that the backend is running and that you're online.";
  else if (status >= 500)
    hint = "The server hit an error. If you just updated the app, run `python manage.py migrate` in the backend folder, then restart Django.";
  else hint = `Unexpected response from the server (${status}).`;

  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full text-center bg-white border border-[#DDE3E8] rounded-xl p-6">
        <p className="font-medium text-[#1B2A41]">Couldn't load {what}</p>
        <p className="text-sm text-[#5B6B7F] mt-2">{hint}</p>
        {status ? <p className="text-xs text-[#9AA6B2] mt-2">Error code: {status}</p> : null}
        <button onClick={onRetry} className="mt-4 text-sm font-medium text-white bg-[#1B2A41] hover:bg-[#12283F] rounded-md px-5 py-2.5 min-h-[44px] transition">
          Try again
        </button>
      </div>
    </div>
  );
}
