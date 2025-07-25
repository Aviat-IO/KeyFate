import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DeleteConfirm } from "@/components/delete-confirm";

// Mock Dialog components
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    onOpenChange,
    children
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="dialog" data-open={open}>
      {open && (
        <div>
          <button
            onClick={() => onOpenChange(false)}
            data-testid="dialog-close"
          >
            Close
          </button>
          {children}
        </div>
      )}
    </div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}));

describe("DeleteConfirm Component", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnConfirm = vi.fn();

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    onConfirm: mockOnConfirm,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render dialog when open", () => {
    render(<DeleteConfirm {...defaultProps} />);

    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-header")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-footer")).toBeInTheDocument();
  });

  it("should not render dialog content when closed", () => {
    render(<DeleteConfirm {...defaultProps} open={false} />);

    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "false");
    expect(screen.queryByTestId("dialog-content")).not.toBeInTheDocument();
  });

  it("should render default title and description", () => {
    render(<DeleteConfirm {...defaultProps} />);

    expect(screen.getByTestId("dialog-title")).toHaveTextContent(
      "Are you absolutely sure?"
    );
    expect(screen.getByTestId("dialog-description")).toHaveTextContent(
      "This action cannot be undone. This will permanently delete this item."
    );
  });

  it("should render custom title and description", () => {
    render(
      <DeleteConfirm
        {...defaultProps}
        title="Delete Secret"
        description="This will permanently delete your secret."
      />
    );

    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Delete Secret");
    expect(screen.getByTestId("dialog-description")).toHaveTextContent(
      "This will permanently delete your secret."
    );
  });

  it("should render custom button text", () => {
    render(
      <DeleteConfirm
        {...defaultProps}
        confirmText="Delete Forever"
        cancelText="Keep It"
      />
    );

    expect(screen.getByRole("button", { name: "Delete Forever" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep It" })).toBeInTheDocument();
  });

  it("should render default button text", () => {
    render(<DeleteConfirm {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("should call onConfirm when confirm button is clicked", () => {
    render(<DeleteConfirm {...defaultProps} />);

    const confirmButton = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it("should call onOpenChange when cancel button is clicked", () => {
    render(<DeleteConfirm {...defaultProps} />);

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("should show loading state on confirm button", () => {
    render(<DeleteConfirm {...defaultProps} loading={true} />);

    const confirmButton = screen.getByRole("button", { name: "Deleting..." });
    expect(confirmButton).toBeInTheDocument();
    expect(confirmButton).toBeDisabled();
  });

  it("should show loading state on cancel button", () => {
    render(<DeleteConfirm {...defaultProps} loading={true} />);

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    expect(cancelButton).toBeDisabled();
  });

  it("should render AlertTriangle icon", () => {
    render(<DeleteConfirm {...defaultProps} />);

    // Check for the icon container
    const iconContainer = document.querySelector(".bg-destructive\\/10");
    expect(iconContainer).toBeInTheDocument();
  });

  it("should have correct destructive styling on confirm button", () => {
    render(<DeleteConfirm {...defaultProps} />);

    const confirmButton = screen.getByRole("button", { name: "Delete" });
    expect(confirmButton).toHaveClass("bg-destructive");
  });

  it("should have correct outline styling on cancel button", () => {
    render(<DeleteConfirm {...defaultProps} />);

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    expect(cancelButton).toHaveClass("border-input");
  });

  it("should handle rapid button clicks", () => {
    render(<DeleteConfirm {...defaultProps} />);

    const confirmButton = screen.getByRole("button", { name: "Delete" });

    // Click multiple times rapidly
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(3);
  });

  it("should prevent interactions when loading", () => {
    render(<DeleteConfirm {...defaultProps} loading={true} />);

    const confirmButton = screen.getByRole("button", { name: "Deleting..." });
    const cancelButton = screen.getByRole("button", { name: "Cancel" });

    fireEvent.click(confirmButton);
    fireEvent.click(cancelButton);

    // Should not call handlers when disabled
    expect(mockOnConfirm).not.toHaveBeenCalled();
    expect(mockOnOpenChange).not.toHaveBeenCalled();
  });

  it("should maintain dialog state correctly", () => {
    const { rerender } = render(
      <DeleteConfirm {...defaultProps} open={false} />
    );

    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "false");

    rerender(<DeleteConfirm {...defaultProps} open={true} />);

    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
  });
});
