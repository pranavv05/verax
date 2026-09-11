const TYPE_STYLES = {
  pdf: { label: "PDF", fill: "#FEE2E2", text: "#B91C1C" },
  jpg: { label: "JPG", fill: "#EDE9FE", text: "#6D28D9" },
  jpeg: { label: "JPG", fill: "#EDE9FE", text: "#6D28D9" },
  png: { label: "PNG", fill: "#DBEAFE", text: "#1D4ED8" },
  xlsx: { label: "XLS", fill: "#D1FAE5", text: "#047857" },
  default: { label: "FILE", fill: "#EDF1F7", text: "#4A566B" }
};

export const fileExtension = (name = "") => name.split(".").pop()?.toLowerCase() || "";

/** Small document glyph labelled with the file extension. */
const FileTypeIcon = ({ extension = "", size = 34 }) => {
  const style = TYPE_STYLES[extension.toLowerCase()] || TYPE_STYLES.default;

  return (
    <svg
      width={size}
      height={size * (44 / 34)}
      viewBox="0 0 34 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="flex-none"
    >
      <path
        d="M4 3.5A2.5 2.5 0 0 1 6.5 1H21l9 9v30.5a2.5 2.5 0 0 1-2.5 2.5h-21A2.5 2.5 0 0 1 4 40.5v-37Z"
        fill="#FFFFFF"
        stroke="#DDE3ED"
        strokeWidth="1.4"
      />
      <path d="M21 1l9 9h-6.5A2.5 2.5 0 0 1 21 7.5V1Z" fill="#EDF1F7" />
      <rect x="4" y="22" width="26" height="13" rx="3" fill={style.fill} />
      <text
        x="17"
        y="31.4"
        textAnchor="middle"
        fontSize="8.2"
        fontWeight="700"
        fontFamily="Inter, -apple-system, Segoe UI, sans-serif"
        fill={style.text}
        letterSpacing="0.2"
      >
        {style.label}
      </text>
    </svg>
  );
};

export default FileTypeIcon;
