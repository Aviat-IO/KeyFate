<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import { cn } from '$lib/utils';

  let {
    length = 8,
    onComplete,
    onChange,
    disabled = false,
    class: className
  }: {
    length?: number;
    onComplete: (otp: string) => void;
    onChange: (otp: string) => void;
    disabled?: boolean;
    class?: string;
  } = $props();

  let otp = $state<string[]>(new Array(length).fill(''));
  let inputRefs = $state<(HTMLInputElement | null)[]>(new Array(length).fill(null));

  $effect(() => {
    // Auto-focus first input on mount
    inputRefs[0]?.focus();
  });

  function handleChange(value: string, index: number) {
    const numericValue = value.replace(/\D/g, '');

    if (numericValue.length > 1) {
      // Handle paste
      const otpArray = numericValue.slice(0, length).split('');
      const newOtp = [...otp];

      otpArray.forEach((digit, i) => {
        if (index + i < length) {
          newOtp[index + i] = digit;
        }
      });

      otp = newOtp;
      onChange(newOtp.join(''));

      if (newOtp.join('').length === length) {
        onComplete(newOtp.join(''));
      }

      const nextIndex = Math.min(index + otpArray.length, length - 1);
      inputRefs[nextIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = numericValue;

    otp = newOtp;
    onChange(newOtp.join(''));

    if (numericValue && index < length - 1) {
      inputRefs[index + 1]?.focus();
    }

    if (newOtp.every((digit) => digit !== '') && newOtp.length === length) {
      setTimeout(() => onComplete(newOtp.join('')), 0);
    }
  }

  function handleKeyDown(e: KeyboardEvent, index: number) {
    if (e.key === 'Backspace') {
      e.preventDefault();

      const newOtp = [...otp];

      if (newOtp[index]) {
        newOtp[index] = '';
      } else if (index > 0) {
        newOtp[index - 1] = '';
        inputRefs[index - 1]?.focus();
      }

      otp = newOtp;
      onChange(newOtp.join(''));
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs[index + 1]?.focus();
    }
  }

  function handleFocus(index: number) {
    inputRefs[index]?.select();
  }

  function handlePaste(e: ClipboardEvent, index: number) {
    e.preventDefault();
    const pastedData = e.clipboardData?.getData('text').replace(/\D/g, '');
    if (pastedData) {
      handleChange(pastedData, index);
    }
  }
</script>

<div class={cn('flex justify-center gap-1.5 sm:gap-2', className)}>
  {#each otp as digit, index}
    <input
      bind:this={inputRefs[index]}
      type="text"
      inputmode="numeric"
      maxlength={1}
      value={digit}
      oninput={(e) => handleChange((e.target as HTMLInputElement).value, index)}
      onkeydown={(e) => handleKeyDown(e, index)}
      onfocus={() => handleFocus(index)}
      onclick={() => handleFocus(index)}
      onpaste={(e) => handlePaste(e, index)}
      {disabled}
      class={cn(
        'h-10 w-10 rounded-md border-2 text-center font-mono text-base sm:h-12 sm:w-12 sm:text-lg',
        'focus:border-primary focus:ring-primary/20 focus:ring-2',
        digit ? 'border-primary' : 'border-input'
      )}
      autocomplete="one-time-code"
      data-testid={`otp-input-${index}`}
    />
  {/each}
</div>
