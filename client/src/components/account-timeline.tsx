import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { MonthlyResult } from "@shared/schema";
import { formatCurrency } from "@/lib/format";

interface AccountTimelineProps {
  data: MonthlyResult[];
  currency: string;
  accountName: string;
}

export function AccountTimeline({ data, currency, accountName }: AccountTimelineProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    // Sort data by month to ensure correct ordering
    const sortedData = [...data].sort((a, b) => a.month - b.month);
    const months = sortedData.map(r => r.month);
    const balances = sortedData.map(r => Math.max(0, r.endingBalanceCents / 100));
    const payments = sortedData.map(r => r.paymentCents / 100);

    const option = {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
        },
        formatter: function (params: any) {
          const month = params[0].axisValue;
          const balance = params[0].value;
          const payment = params[1] ? params[1].value : 0;
          
          return `
            <div style="font-weight: bold; margin-bottom: 8px;">Month ${month}</div>
            <div style="margin: 4px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${params[0].color}; margin-right: 8px;"></span>
              <span>Balance: </span>
              <span style="font-weight: bold;">${formatCurrency(Math.round(balance * 100), currency)}</span>
            </div>
            ${payment > 0 ? `
              <div style="margin: 4px 0;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${params[1].color}; margin-right: 8px;"></span>
                <span>Payment: </span>
                <span style="font-weight: bold;">${formatCurrency(Math.round(payment * 100), currency)}</span>
              </div>
            ` : ''}
          `;
        },
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "10%",
        top: "8%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: months,
        name: "Month",
        nameLocation: "middle",
        nameGap: 25,
      },
      yAxis: {
        type: "value",
        name: "Amount",
        axisLabel: {
          formatter: (value: number) => {
            const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";
            return `${symbol}${value >= 1000 ? (value / 1000).toFixed(1) + "k" : value}`;
          },
        },
      },
      series: [
        {
          name: "Balance",
          type: "line",
          data: balances,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(59, 130, 246, 0.3)" },
              { offset: 1, color: "rgba(59, 130, 246, 0.05)" },
            ]),
          },
          lineStyle: {
            width: 2,
          },
          itemStyle: {
            color: "#3b82f6",
          },
          smooth: true,
        },
        {
          name: "Payment",
          type: "bar",
          data: payments,
          itemStyle: {
            color: "rgba(16, 185, 129, 0.6)",
          },
          barMaxWidth: 20,
        },
      ],
    };

    chartInstance.current.setOption(option);

    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [data, currency, accountName]);

  return (
    <div
      ref={chartRef}
      className="w-full h-64"
      data-testid={`chart-account-timeline-${accountName}`}
    />
  );
}
