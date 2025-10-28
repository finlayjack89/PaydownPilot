import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { MonthlyResult } from "@shared/schema";
import { formatCurrency } from "@/lib/format";

interface DebtTimelineProps {
  data: MonthlyResult[];
  currency: string;
}

export function DebtTimeline({ data, currency }: DebtTimelineProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    // Initialize chart
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    // Group data by lender
    const lenders = [...new Set(data.map(r => r.lenderName))];
    const months = [...new Set(data.map(r => r.month))].sort((a, b) => a - b);

    // Prepare series data
    const series = lenders.map(lender => {
      const lenderData = months.map(month => {
        const row = data.find(r => r.lenderName === lender && r.month === month);
        return row ? Math.max(0, row.endingBalanceCents / 100) : 0;
      });

      return {
        name: lender,
        type: "line",
        stack: "Total",
        areaStyle: {},
        emphasis: {
          focus: "series",
        },
        data: lenderData,
      };
    });

    // Configure chart
    const option = {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
          label: {
            backgroundColor: "#6a7985",
          },
        },
        formatter: function (params: any) {
          let total = 0;
          let html = `<div style="font-weight: bold; margin-bottom: 8px;">Month ${params[0].axisValue}</div>`;
          
          params.forEach((param: any) => {
            const value = param.value;
            total += value;
            if (value > 0) {
              html += `
                <div style="display: flex; align-items: center; margin: 4px 0;">
                  <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${param.color}; margin-right: 8px;"></span>
                  <span style="flex: 1;">${param.seriesName}</span>
                  <span style="font-weight: bold; margin-left: 16px;">${formatCurrency(Math.round(value * 100), currency)}</span>
                </div>
              `;
            }
          });
          
          html += `<div style="border-top: 1px solid #ccc; margin-top: 8px; padding-top: 8px; font-weight: bold;">Total: ${formatCurrency(Math.round(total * 100), currency)}</div>`;
          return html;
        },
      },
      legend: {
        data: lenders,
        bottom: 0,
        type: "scroll",
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "15%",
        top: "3%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: months,
        name: "Month",
        nameLocation: "middle",
        nameGap: 30,
      },
      yAxis: {
        type: "value",
        name: "Balance",
        axisLabel: {
          formatter: (value: number) => {
            const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";
            return `${symbol}${value >= 1000 ? (value / 1000).toFixed(1) + "k" : value}`;
          },
        },
      },
      series: series,
      color: [
        "#3b82f6", // blue
        "#10b981", // green
        "#8b5cf6", // purple
        "#f59e0b", // amber
        "#ef4444", // red
        "#06b6d4", // cyan
        "#ec4899", // pink
      ],
    };

    chartInstance.current.setOption(option);

    // Handle resize
    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [data, currency]);

  return (
    <div
      ref={chartRef}
      className="w-full h-96 md:h-[32rem]"
      data-testid="chart-debt-timeline"
    />
  );
}
