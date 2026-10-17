// Line icons (24px grid, 1.75 stroke). Decorative by default; pass `label` to expose to screen readers.
const P = {
  siren: <><path d="M7 18v-6a5 5 0 0 1 10 0v6" /><path d="M5 18h14v3H5z" /><path d="M12 3v2M4.2 6.2l1.4 1.4M19.8 6.2l-1.4 1.4M2 12h2M20 12h2" /></>,
  route: <><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  bag: <><path d="M5 8h14l-1 13H6z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /><path d="M9 13h6" /></>,
  rocket: <><path d="M5 15c-1.5 1.5-2 4-2 6 2 0 4.5-.5 6-2" /><path d="M9 15l-3-3c2-6 7-9 15-9 0 8-3 13-9 15z" /><circle cx="15" cy="9" r="1.5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  note: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 12h7M9 16h7" /></>,
  map: <><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15M15 6v15" /></>,
  chat: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></>,
  tool: <><path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L3 18l3 3 6.2-6.2a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.5-.5-.5-2.5z" /></>,
  phone: <><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" /></>,
  download: <><path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5" /><path d="M4 19.5h16" /></>,
  android: <><path d="M6 10h12v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" /><path d="M6 10a6 6 0 0 1 12 0" /><path d="M8 5L6.5 3M16 5l1.5-2M9.5 7.5h.01M14.5 7.5h.01" /></>,
  apple: <><path d="M16 3c0 2-1.5 3.5-3.3 3.5C12.7 4.6 14.2 3 16 3z" /><path d="M12 8c-1.2 0-2.2-.8-3.5-.8C6 7.2 4 9.3 4 13c0 4.5 3 8 5 8 1 0 1.8-.6 3-.6s2 .6 3 .6c1.6 0 3.6-2.6 4.5-5.4-2-.9-3-2.5-3-4.4 0-1.7.9-3 2.3-3.7C17.9 6.6 16.3 7.2 15.3 7.2 14 7.2 13.2 8 12 8z" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="M6 6l12 12M18 6L6 18" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  rotate: <><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  minus: <><path d="M5 12h14" /></>,
};

export default function Icon({ name, size = 22, label, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {P[name]}
    </svg>
  );
}
