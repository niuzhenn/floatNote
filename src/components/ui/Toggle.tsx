import * as SwitchPrimitive from "@radix-ui/react-switch";

interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function Toggle({ checked, onCheckedChange, disabled, label }: ToggleProps) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className="relative h-[22px] w-[38px] shrink-0 cursor-pointer rounded-full bg-black/[0.14] outline-none transition-colors duration-150 data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
    >
      <SwitchPrimitive.Thumb className="block h-[18px] w-[18px] translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-150 ease-paper data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}
