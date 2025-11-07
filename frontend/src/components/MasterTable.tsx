import { useState } from "react";

interface LineItem {
  id: string;
  item: string;
  quantity: string;
  rate: string;
  amount: string;
  source_invoice_number: string;
  vendor: string;
  date: string;
}

interface MasterTableProps {
  line_items: LineItem[];
}

const MasterTable: React.FC<MasterTableProps> = ({ line_items }) => {
  const [editedItems, setEditedItems] = useState(line_items);

  const handleCellEdit = (id: string, field: keyof LineItem, value: string) => {
    setEditedItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}
      >
        <thead style={{ backgroundColor: "#f8f9fa" }}>
          <tr>
            <th
              style={{
                padding: "0.75rem",
                border: "1px solid #dee2e6",
                textAlign: "left",
              }}
            >
              Item
            </th>
            <th
              style={{
                padding: "0.75rem",
                border: "1px solid #dee2e6",
                textAlign: "center",
              }}
            >
              Quantity
            </th>
            <th
              style={{
                padding: "0.75rem",
                border: "1px solid #dee2e6",
                textAlign: "center",
              }}
            >
              Rate
            </th>
            <th style={{ padding: "editable-cell" }}>Amount</th>
            <th
              style={{
                padding: "0.75rem",
                border: "1px solid #dee2e6",
                textAlign: "left",
              }}
            >
              Vendor
            </th>
            <th style={{ padding: "editable-cell" }}>Invoice #</th>
          </tr>
        </thead>
        <tbody>
          {editedItems.map((item) => (
            <tr key={item.id}>
              <td style={{ padding: "0.75rem", border: "1px solid #dee2e6" }}>
                {item.item}
              </td>
              <td
                style={{
                  padding: "0.75rem",
                  border: "editable-cell",
                  textAlign: "center",
                }}
              >
                {item.quantity}
              </td>
              <td
                style={{
                  padding: "0.75rem",
                  border: "editable-cell",
                  textAlign: "center",
                }}
              >
                {item.rate}
              </td>
              <td
                style={{
                  padding: "0.75rem",
                  border: "editable-cell",
                  textAlign: "right",
                }}
              >
                <span
                  contentEditable
                  onBlur={(e) =>
                    handleCellEdit(
                      item.id,
                      "amount",
                      e.currentTarget.textContent
                    )
                  }
                  style={{
                    outline: "none",
                    cursor: "text",
                    padding: "4px",
                    borderRadius: "4px",
                    backgroundColor: "transparent",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.backgroundColor = "#f0f8ff")
                  }
                  onBlurCapture={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  {item.amount}
                </span>
              </td>
              <td style={{ padding: '0.75rem', border: '1px solid #dee2e6'}}>{item.vendor}</td>
              <td style={{padding: '0.75rem', border: '1px solid #de2e6'}}>{item.source_invoice_number}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
