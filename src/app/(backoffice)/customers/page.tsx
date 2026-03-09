"use client";

import { MOCK_CUSTOMERS } from "@/lib/backoffice-mock";

export default function CustomersPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-sakura-900">Customers</h1>
        <span className="text-sm text-muted-dark">
          {MOCK_CUSTOMERS.length} customers
        </span>
      </div>

      <div className="rounded-xl border border-card-border bg-white shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-xs text-muted-dark bg-sakura-50">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium text-center">Verified</th>
                <th className="px-5 py-3 font-medium text-center">Orders</th>
                <th className="px-5 py-3 font-medium">Registered</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_CUSTOMERS.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-card-border last:border-0 hover:bg-sakura-50 transition-colors"
                >
                  <td className="px-5 py-3 font-medium text-sakura-900">
                    {customer.name}
                  </td>
                  <td className="px-5 py-3 text-sakura-700">
                    {customer.email}
                  </td>
                  <td className="px-5 py-3 text-sakura-700">
                    {customer.phone ?? <span className="text-muted">-</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        customer.role === "admin"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {customer.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    {customer.isEmailVerified ? (
                      <span
                        className="inline-block h-2 w-2 rounded-full bg-green-500"
                        title="Verified"
                      />
                    ) : (
                      <span
                        className="inline-block h-2 w-2 rounded-full bg-gray-300"
                        title="Not verified"
                      />
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {customer.orderCount}
                  </td>
                  <td className="px-5 py-3 text-muted-dark">
                    {new Date(customer.createdAt).toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
