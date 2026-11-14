using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace App.Migrations
{
    /// <inheritdoc />
    public partial class AddSavedGameAndAnalysisTasks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DELETE FROM ""AnalysisTasks"";");

            migrationBuilder.AddColumn<int>(
                name: "UserId",
                table: "AnalysisTasks",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "SavedGames",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    PlayerName = table.Column<string>(type: "text", nullable: false),
                    BotName = table.Column<string>(type: "text", nullable: false),
                    BotElo = table.Column<int>(type: "integer", nullable: false),
                    PlayerColor = table.Column<string>(type: "text", nullable: false),
                    ResultStatus = table.Column<string>(type: "text", nullable: false),
                    FenHistoryJson = table.Column<string>(type: "text", nullable: false),
                    MovesSanJson = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavedGames", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SavedGames_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AnalysisTasks_Id",
                table: "AnalysisTasks",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_AnalysisTasks_UserId",
                table: "AnalysisTasks",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_SavedGames_Id",
                table: "SavedGames",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_SavedGames_UserId",
                table: "SavedGames",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_AnalysisTasks_Users_UserId",
                table: "AnalysisTasks",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AnalysisTasks_Users_UserId",
                table: "AnalysisTasks");

            migrationBuilder.DropTable(
                name: "SavedGames");

            migrationBuilder.DropIndex(
                name: "IX_AnalysisTasks_Id",
                table: "AnalysisTasks");

            migrationBuilder.DropIndex(
                name: "IX_AnalysisTasks_UserId",
                table: "AnalysisTasks");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "AnalysisTasks");
        }
    }
}
