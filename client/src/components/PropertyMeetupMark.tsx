export function PropertyMeetupMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 34"
      fill="none"
      className={className}
      role="img"
      aria-label="Property meetup"
    >
      <defs>
        <linearGradient
          id="property-meetup-gradient"
          x1="3"
          y1="27"
          x2="34"
          y2="7"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7c2cff" />
          <stop offset="0.42" stopColor="#d946ef" />
          <stop offset="0.75" stopColor="#f472b6" />
          <stop offset="1" stopColor="#ffc56b" />
        </linearGradient>
        <linearGradient
          id="property-meetup-fill"
          x1="5"
          y1="26"
          x2="30"
          y2="6"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#a855f7" stopOpacity=".24" />
          <stop offset="1" stopColor="#fb7185" stopOpacity=".08" />
        </linearGradient>
      </defs>
      <path
        d="M15 28V10.5L25.5 4 35 10.5V28H15Z"
        stroke="url(#property-meetup-gradient)"
        strokeWidth="3.2"
        strokeLinejoin="round"
        fill="url(#property-meetup-fill)"
      />
      <circle
        cx="25.5"
        cy="4"
        r="1.7"
        fill="#f472b6"
        stroke="url(#property-meetup-gradient)"
        strokeWidth="1"
      />
      <path
        d="M4 17h12.5c2.2 0 4 1.8 4 4v7H4V17Z"
        stroke="url(#property-meetup-gradient)"
        strokeWidth="3.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="url(#property-meetup-fill)"
      />
      <path
        d="M8 28v-5.5h6v5.5M20 28v-5h6v5"
        stroke="url(#property-meetup-gradient)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}